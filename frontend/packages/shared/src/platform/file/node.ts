import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { FileAdapter, FileSelection, FileSelectionOptions } from './base';

export class NodeFileAdapter extends FileAdapter {
  async selectFile(options?: FileSelectionOptions): Promise<FileSelection | null> {
    try {
      // In CLI, prompt user for file path
      const filePath = await this.promptForFilePath('Enter file path: ');

      if (!filePath) {
        return null;
      }

      // Check if file exists
      const exists = await this.fileExists(filePath);
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get file info
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath);

      // Determine MIME type based on extension
      const mimeType = this.getMimeTypeFromExtension(fileExtension);

      const fileSelection: FileSelection = {
        uri: path.resolve(filePath),
        name: fileName,
        size: stats.size,
        type: mimeType,
        lastModified: stats.mtime.getTime(),
      };

      // Validate file if options provided
      if (options) {
        const validation = await this.validateFileSelection(fileSelection, options);
        if (!validation.isValid) {
          throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
        }
      }

      return fileSelection;
    } catch (error) {
      console.error('File selection error:', error);
      throw error;
    }
  }

  async selectFiles(options?: FileSelectionOptions): Promise<FileSelection[]> {
    const files: FileSelection[] = [];

    console.log('Enter file paths (one per line, empty line to finish):');

    while (true) {
      const filePath = await this.promptForFilePath('File path (or press Enter to finish): ');

      if (!filePath) {
        break;
      }

      try {
        const file = await this.selectFile(options);
        if (file) {
          files.push(file);
        }
      } catch (error) {
        console.error(`Error selecting file ${filePath}:`, error);
        // Continue to next file
      }
    }

    return files;
  }

  async readFileAsBase64(uri: string): Promise<string> {
    try {
      const buffer = await fs.readFile(uri);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to read file as base64: ${error}`);
    }
  }

  async readFileAsText(uri: string): Promise<string> {
    try {
      return await fs.readFile(uri, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read file as text: ${error}`);
    }
  }

  async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    try {
      await fs.writeFile(filePath, content);
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  async deleteFile(uri: string): Promise<void> {
    try {
      await fs.unlink(uri);
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      await fs.access(uri);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(uri: string): Promise<{
    size: number;
    lastModified: number;
    type: string;
  } | null> {
    try {
      const stats = await fs.stat(uri);
      const extension = path.extname(uri);
      const mimeType = this.getMimeTypeFromExtension(extension);

      return {
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        type: mimeType,
      };
    } catch {
      return null;
    }
  }

  private async promptForFilePath(message: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.json': 'application/json',
      '.xml': 'application/xml',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  private async validateFileSelection(
    file: FileSelection,
    options: FileSelectionOptions
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check file size
    if (options.maxSize && file.size > options.maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${options.maxSize} bytes`);
    }

    // Check file type
    if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension
    if (options.allowedExtensions) {
      const extension = path.extname(file.name).toLowerCase();
      if (!options.allowedExtensions.some(ext => ext.toLowerCase() === extension)) {
        errors.push(`File extension ${extension} is not allowed`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // CLI-specific helper methods
  async selectFileWithGlob(pattern: string): Promise<FileSelection[]> {
    try {
      const globModule = await import('glob');

      // Handle both default export and named export
      const globFunc = globModule.glob || globModule.default;

      // Use promise-based API for glob v7
      const files = await new Promise<string[]>((resolve, reject) => {
        globFunc(pattern, (err: Error | null, matches: string[]) => {
          if (err) reject(err);
          else resolve(matches);
        });
      });

      const selections: FileSelection[] = [];

      for (const filePath of files) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            const fileName = path.basename(filePath);
            const fileExtension = path.extname(filePath);
            const mimeType = this.getMimeTypeFromExtension(fileExtension);

            selections.push({
              uri: path.resolve(filePath),
              name: fileName,
              size: stats.size,
              type: mimeType,
              lastModified: stats.mtime.getTime(),
            });
          }
        } catch (error) {
          console.warn(`Skipping file ${filePath}: ${error}`);
        }
      }

      return selections;
    } catch (error) {
      throw new Error(`Failed to select files with pattern ${pattern}: ${error}`);
    }
  }

  async listDirectory(dirPath: string): Promise<FileSelection[]> {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });
      const files: FileSelection[] = [];

      for (const item of items) {
        if (item.isFile()) {
          const filePath = path.join(dirPath, item.name);
          const stats = await fs.stat(filePath);
          const fileExtension = path.extname(item.name);
          const mimeType = this.getMimeTypeFromExtension(fileExtension);

          files.push({
            uri: path.resolve(filePath),
            name: item.name,
            size: stats.size,
            type: mimeType,
            lastModified: stats.mtime.getTime(),
          });
        }
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error}`);
    }
  }
}
