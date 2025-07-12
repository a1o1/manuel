"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStorage = exports.AuthStorage = exports.SecureStorage = void 0;
const platform_1 = require("../platform");
// Get the storage keys from constants
let STORAGE_KEYS;
try {
    STORAGE_KEYS = require('../constants').STORAGE_KEYS;
}
catch {
    // Fallback for when constants are not available
    STORAGE_KEYS = {
        AUTH_TOKENS: '@manuel:auth_tokens',
        USER_DATA: '@manuel:user_data',
    };
}
// Legacy wrapper for backward compatibility
class SecureStorage {
    static getStorageService() {
        return (0, platform_1.getStorageService)();
    }
    static async setItem(key, value) {
        try {
            const storageService = this.getStorageService();
            await storageService.setItem(key, value);
        }
        catch (error) {
            console.error('Error storing secure item:', error);
            throw error;
        }
    }
    static async getItem(key) {
        try {
            const storageService = this.getStorageService();
            return await storageService.getItem(key);
        }
        catch (error) {
            console.error('Error retrieving secure item:', error);
            return null;
        }
    }
    static async removeItem(key) {
        try {
            const storageService = this.getStorageService();
            await storageService.removeItem(key);
        }
        catch (error) {
            console.error('Error removing secure item:', error);
            throw error;
        }
    }
    static async clear() {
        try {
            const storageService = this.getStorageService();
            await storageService.clearAll();
        }
        catch (error) {
            console.error('Error clearing secure storage:', error);
            throw error;
        }
    }
}
exports.SecureStorage = SecureStorage;
// Auth token storage using platform-agnostic service
exports.AuthStorage = {
    async storeTokens(tokens) {
        const storageService = (0, platform_1.getStorageService)();
        await storageService.storeAuthTokens(tokens);
    },
    async getTokens() {
        const storageService = (0, platform_1.getStorageService)();
        return await storageService.getAuthTokens();
    },
    async removeTokens() {
        const storageService = (0, platform_1.getStorageService)();
        await storageService.removeAuthTokens();
    },
};
// User data storage using platform-agnostic service
exports.UserStorage = {
    async storeUser(user) {
        const storageService = (0, platform_1.getStorageService)();
        await storageService.storeUser(user);
    },
    async getUser() {
        const storageService = (0, platform_1.getStorageService)();
        return await storageService.getUser();
    },
    async removeUser() {
        const storageService = (0, platform_1.getStorageService)();
        await storageService.removeUser();
    },
};
//# sourceMappingURL=storage.js.map