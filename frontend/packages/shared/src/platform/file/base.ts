// File selection result
export interface FileSelection {
  uri: string;
  name: string;
  size: number;
  type: string;
  lastModified?: number;
}

// File selection options
export interface FileSelectionOptions {
  allowedTypes?: string[];
  allowedExtensions?: string[];
  maxSize?: number; // in bytes
  multiple?: boolean;
}

// Abstract file interface
export abstract class FileAdapter {
  abstract selectFile(options?: FileSelectionOptions): Promise<FileSelection | null>;
  abstract selectFiles(options?: FileSelectionOptions): Promise<FileSelection[]>;
  abstract readFileAsBase64(uri: string): Promise<string>;
  abstract readFileAsText(uri: string): Promise<string>;
  abstract writeFile(path: string, content: string | Buffer): Promise<void>;
  abstract deleteFile(uri: string): Promise<void>;
  abstract fileExists(uri: string): Promise<boolean>;
  abstract getFileInfo(uri: string): Promise<{
    size: number;
    lastModified: number;
    type: string;
  } | null>;
}

// File service wrapper
export class FileService {
  constructor(private adapter: FileAdapter) {}

  async selectManual(options?: FileSelectionOptions): Promise<FileSelection | null> {
    const defaultOptions: FileSelectionOptions = {
      allowedTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/markdown',
        'text/html',
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.md', '.html', '.htm'],
      maxSize: 50 * 1024 * 1024, // 50MB
      multiple: false,
    };

    const mergedOptions = { ...defaultOptions, ...options };
    return await this.adapter.selectFile(mergedOptions);
  }

  async convertFileToBase64(file: FileSelection): Promise<string> {
    return await this.adapter.readFileAsBase64(file.uri);
  }

  async readTextFile(uri: string): Promise<string> {
    return await this.adapter.readFileAsText(uri);
  }

  async validateFile(file: FileSelection, options?: FileSelectionOptions): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check file size
    if (options?.maxSize && file.size > options.maxSize) {
      errors.push(`File size ${file.size} exceeds maximum ${options.maxSize} bytes`);
    }

    // Check file type
    if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed`);
    }

    // Check file extension
    if (options?.allowedExtensions) {
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
