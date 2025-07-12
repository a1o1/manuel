import { FileAdapter, FileSelection, FileSelectionOptions } from './base';
export declare class NodeFileAdapter extends FileAdapter {
    selectFile(options?: FileSelectionOptions): Promise<FileSelection | null>;
    selectFiles(options?: FileSelectionOptions): Promise<FileSelection[]>;
    readFileAsBase64(uri: string): Promise<string>;
    readFileAsText(uri: string): Promise<string>;
    writeFile(filePath: string, content: string | Buffer): Promise<void>;
    deleteFile(uri: string): Promise<void>;
    fileExists(uri: string): Promise<boolean>;
    getFileInfo(uri: string): Promise<{
        size: number;
        lastModified: number;
        type: string;
    } | null>;
    private promptForFilePath;
    private getMimeTypeFromExtension;
    private validateFileSelection;
    selectFileWithGlob(pattern: string): Promise<FileSelection[]>;
    listDirectory(dirPath: string): Promise<FileSelection[]>;
}
//# sourceMappingURL=node.d.ts.map