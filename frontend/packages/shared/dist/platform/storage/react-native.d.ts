import { StorageAdapter } from './base';
export declare class ReactNativeStorageAdapter implements StorageAdapter {
    private SecureStore;
    constructor();
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
//# sourceMappingURL=react-native.d.ts.map