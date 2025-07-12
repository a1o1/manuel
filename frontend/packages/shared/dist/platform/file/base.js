"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileService = exports.FileAdapter = void 0;
// Abstract file interface
class FileAdapter {
}
exports.FileAdapter = FileAdapter;
// File service wrapper
class FileService {
    constructor(adapter) {
        this.adapter = adapter;
    }
    async selectManual(options) {
        const defaultOptions = {
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
    async convertFileToBase64(file) {
        return await this.adapter.readFileAsBase64(file.uri);
    }
    async readTextFile(uri) {
        return await this.adapter.readFileAsText(uri);
    }
    async validateFile(file, options) {
        const errors = [];
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
    async fileExists(uri) {
        return await this.adapter.fileExists(uri);
    }
    async getFileInfo(uri) {
        return await this.adapter.getFileInfo(uri);
    }
}
exports.FileService = FileService;
//# sourceMappingURL=base.js.map