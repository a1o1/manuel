import { StorageAdapter } from './base';
export declare class NodeStorageAdapter implements StorageAdapter {
    private storageDir;
    constructor(appName?: string);
    private ensureStorageDir;
    private getFilePath;
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    getStorageDir(): Promise<string>;
    listKeys(): Promise<string[]>;
}
//# sourceMappingURL=node.d.ts.map