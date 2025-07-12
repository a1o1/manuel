export declare class SecureStorage {
    private static getStorageService;
    static setItem(key: string, value: string): Promise<void>;
    static getItem(key: string): Promise<string | null>;
    static removeItem(key: string): Promise<void>;
    static clear(): Promise<void>;
}
export declare const AuthStorage: {
    storeTokens(tokens: {
        accessToken: string;
        refreshToken: string;
        idToken: string;
    }): Promise<void>;
    getTokens(): Promise<{
        accessToken: string;
        refreshToken: string;
        idToken: string;
    } | null>;
    removeTokens(): Promise<void>;
};
export declare const UserStorage: {
    storeUser(user: any): Promise<void>;
    getUser(): Promise<any | null>;
    removeUser(): Promise<void>;
};
//# sourceMappingURL=storage.d.ts.map