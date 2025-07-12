import { FileAdapter, FileSelection, FileSelectionOptions } from './base';
export declare class ReactNativeFileAdapter extends FileAdapter {
    private DocumentPicker;
    private FileSystem;
    constructor();
    selectFile(options?: FileSelectionOptions): Promise<FileSelection | null>;
    selectFiles(options?: FileSelectionOptions): Promise<FileSelection[]>;
    readFileAsBase64(uri: string): Promise<string>;
    readFileAsText(uri: string): Promise<string>;
    writeFile(path: string, content: string | Buffer): Promise<void>;
    deleteFile(uri: string): Promise<void>;
    fileExists(uri: string): Promise<boolean>;
    getFileInfo(uri: string): Promise<{
        size: number;
        lastModified: number;
        type: string;
    } | null>;
    private mapDocumentTypes;
    private validateFileSelection;
}
//# sourceMappingURL=react-native.d.ts.map