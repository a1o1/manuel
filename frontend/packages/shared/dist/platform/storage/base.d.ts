export interface StorageAdapter {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
}
export declare class StorageService {
    private adapter;
    constructor(adapter: StorageAdapter);
    storeAuthTokens(tokens: {
        accessToken: string;
        refreshToken: string;
        idToken: string;
    }): Promise<void>;
    getAuthTokens(): Promise<{
        accessToken: string;
        refreshToken: string;
        idToken: string;
    } | null>;
    removeAuthTokens(): Promise<void>;
    storeUser(user: any): Promise<void>;
    getUser(): Promise<any | null>;
    removeUser(): Promise<void>;
    storeSettings(settings: any): Promise<void>;
    getSettings(): Promise<any | null>;
    storeQueryHistory(history: any[]): Promise<void>;
    getQueryHistory(): Promise<any[]>;
    clearAll(): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map