import { FileAdapter, FileSelection, FileSelectionOptions } from './base';

export class ReactNativeFileAdapter extends FileAdapter {
  private DocumentPicker: any;
  private FileSystem: any;

  constructor() {
    super();
    try {
      this.DocumentPicker = require('expo-document-picker');
      this.FileSystem = require('expo-file-system');
    } catch (error) {
      throw new Error('expo-document-picker and expo-file-system are required for React Native file operations');
    }
  }

  async selectFile(options?: FileSelectionOptions): Promise<FileSelection | null> {
    try {
      const pickerOptions: any = {
        type: this.mapDocumentTypes(options?.allowedTypes),
        copyToCacheDirectory: true,
        multiple: false,
      };

      const result = await this.DocumentPicker.getDocumentAsync(pickerOptions);

      if (result.type === 'cancel' || !result.uri) {
        return null;
      }

      // Convert to our standard format
      const fileSelection: FileSelection = {
        uri: result.uri,
        name: result.name || 'unknown',
        size: result.size || 0,
        type: result.mimeType || 'application/octet-stream',
        lastModified: Date.now(),
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
    try {
      const pickerOptions: any = {
        type: this.mapDocumentTypes(options?.allowedTypes),
        copyToCacheDirectory: true,
        multiple: true,
      };

      const result = await this.DocumentPicker.getDocumentAsync(pickerOptions);

      if (result.type === 'cancel') {
        return [];
      }

      // Handle both single and multiple file results
      const files = Array.isArray(result) ? result : [result];

      const selections: FileSelection[] = [];

      for (const file of files) {
        if (file.uri) {
          const fileSelection: FileSelection = {
            uri: file.uri,
            name: file.name || 'unknown',
            size: file.size || 0,
            type: file.mimeType || 'application/octet-stream',
            lastModified: Date.now(),
          };

          // Validate file if options provided
          if (options) {
            const validation = await this.validateFileSelection(fileSelection, options);
            if (validation.isValid) {
              selections.push(fileSelection);
            }
          } else {
            selections.push(fileSelection);
          }
        }
      }

      return selections;
    } catch (error) {
      console.error('Multiple file selection error:', error);
      throw error;
    }
  }

  async readFileAsBase64(uri: string): Promise<string> {
    try {
      const base64 = await this.FileSystem.readAsStringAsync(uri, {
        encoding: this.FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (error) {
      throw new Error(`Failed to read file as base64: ${error}`);
    }
  }

  async readFileAsText(uri: string): Promise<string> {
    try {
      const text = await this.FileSystem.readAsStringAsync(uri, {
        encoding: this.FileSystem.EncodingType.UTF8,
      });
      return text;
    } catch (error) {
      throw new Error(`Failed to read file as text: ${error}`);
    }
  }

  async writeFile(path: string, content: string | Buffer): Promise<void> {
    try {
      const stringContent = typeof content === 'string' ? content : content.toString();
      await this.FileSystem.writeAsStringAsync(path, stringContent, {
        encoding: this.FileSystem.EncodingType.UTF8,
      });
    } catch (error) {
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  async deleteFile(uri: string): Promise<void> {
    try {
      await this.FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async fileExists(uri: string): Promise<boolean> {
    try {
      const info = await this.FileSystem.getInfoAsync(uri);
      return info.exists;
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
      const info = await this.FileSystem.getInfoAsync(uri);
      if (!info.exists) return null;

      return {
        size: info.size || 0,
        lastModified: info.modificationTime || Date.now(),
        type: 'application/octet-stream', // FileSystem doesn't provide MIME type
      };
    } catch {
      return null;
    }
  }

  private mapDocumentTypes(allowedTypes?: string[]): string {
    if (!allowedTypes || allowedTypes.length === 0) {
      return '*/*';
    }

    // Map common MIME types to Expo DocumentPicker types
    const typeMap: { [key: string]: string } = {
      'application/pdf': 'application/pdf',
      'application/msword': 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain': 'text/plain',
      'text/markdown': 'text/*',
      'text/html': 'text/html',
    };

    // Return first mapped type or all types
    for (const type of allowedTypes) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }

    return '*/*';
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
      const extension = file.name.toLowerCase().split('.').pop();
      if (!extension || !options.allowedExtensions.some(ext => ext.toLowerCase() === `.${extension}`)) {
        errors.push(`File extension is not allowed`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
