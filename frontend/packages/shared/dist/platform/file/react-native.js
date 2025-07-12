"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeFileAdapter = void 0;
const base_1 = require("./base");
class ReactNativeFileAdapter extends base_1.FileAdapter {
    constructor() {
        super();
        try {
            this.DocumentPicker = require('expo-document-picker');
            this.FileSystem = require('expo-file-system');
        }
        catch (error) {
            throw new Error('expo-document-picker and expo-file-system are required for React Native file operations');
        }
    }
    async selectFile(options) {
        try {
            const pickerOptions = {
                type: this.mapDocumentTypes(options?.allowedTypes),
                copyToCacheDirectory: true,
                multiple: false,
            };
            const result = await this.DocumentPicker.getDocumentAsync(pickerOptions);
            if (result.type === 'cancel' || !result.uri) {
                return null;
            }
            // Convert to our standard format
            const fileSelection = {
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
        }
        catch (error) {
            console.error('File selection error:', error);
            throw error;
        }
    }
    async selectFiles(options) {
        try {
            const pickerOptions = {
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
            const selections = [];
            for (const file of files) {
                if (file.uri) {
                    const fileSelection = {
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
                    }
                    else {
                        selections.push(fileSelection);
                    }
                }
            }
            return selections;
        }
        catch (error) {
            console.error('Multiple file selection error:', error);
            throw error;
        }
    }
    async readFileAsBase64(uri) {
        try {
            const base64 = await this.FileSystem.readAsStringAsync(uri, {
                encoding: this.FileSystem.EncodingType.Base64,
            });
            return base64;
        }
        catch (error) {
            throw new Error(`Failed to read file as base64: ${error}`);
        }
    }
    async readFileAsText(uri) {
        try {
            const text = await this.FileSystem.readAsStringAsync(uri, {
                encoding: this.FileSystem.EncodingType.UTF8,
            });
            return text;
        }
        catch (error) {
            throw new Error(`Failed to read file as text: ${error}`);
        }
    }
    async writeFile(path, content) {
        try {
            const stringContent = typeof content === 'string' ? content : content.toString();
            await this.FileSystem.writeAsStringAsync(path, stringContent, {
                encoding: this.FileSystem.EncodingType.UTF8,
            });
        }
        catch (error) {
            throw new Error(`Failed to write file: ${error}`);
        }
    }
    async deleteFile(uri) {
        try {
            await this.FileSystem.deleteAsync(uri, { idempotent: true });
        }
        catch (error) {
            throw new Error(`Failed to delete file: ${error}`);
        }
    }
    async fileExists(uri) {
        try {
            const info = await this.FileSystem.getInfoAsync(uri);
            return info.exists;
        }
        catch {
            return false;
        }
    }
    async getFileInfo(uri) {
        try {
            const info = await this.FileSystem.getInfoAsync(uri);
            if (!info.exists)
                return null;
            return {
                size: info.size || 0,
                lastModified: info.modificationTime || Date.now(),
                type: 'application/octet-stream', // FileSystem doesn't provide MIME type
            };
        }
        catch {
            return null;
        }
    }
    mapDocumentTypes(allowedTypes) {
        if (!allowedTypes || allowedTypes.length === 0) {
            return '*/*';
        }
        // Map common MIME types to Expo DocumentPicker types
        const typeMap = {
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
    async validateFileSelection(file, options) {
        const errors = [];
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
exports.ReactNativeFileAdapter = ReactNativeFileAdapter;
//# sourceMappingURL=react-native.js.map