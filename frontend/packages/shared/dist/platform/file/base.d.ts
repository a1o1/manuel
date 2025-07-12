export interface FileSelection {
    uri: string;
    name: string;
    size: number;
    type: string;
    lastModified?: number;
}
export interface FileSelectionOptions {
    allowedTypes?: string[];
    allowedExtensions?: string[];
    maxSize?: number;
    multiple?: boolean;
}
export declare abstract class FileAdapter {
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
export declare class FileService {
    private adapter;
    constructor(adapter: FileAdapter);
    selectManual(options?: FileSelectionOptions): Promise<FileSelection | null>;
    convertFileToBase64(file: FileSelection): Promise<string>;
    readTextFile(uri: string): Promise<string>;
    validateFile(file: FileSelection, options?: FileSelectionOptions): Promise<{
        isValid: boolean;
        errors: string[];
    }>;
    fileExists(uri: string): Promise<boolean>;
    getFileInfo(uri: string): Promise<{
        size: number;
        lastModified: number;
        type: string;
    } | null>;
}
//# sourceMappingURL=base.d.ts.map