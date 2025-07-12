"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
// Import storage keys from constants
const config_1 = require("../../constants/config");
// Platform-agnostic storage service
class StorageService {
    constructor(adapter) {
        this.adapter = adapter;
    }
    async storeAuthTokens(tokens) {
        await this.adapter.setItem(config_1.STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
    }
    async getAuthTokens() {
        const tokensJson = await this.adapter.getItem(config_1.STORAGE_KEYS.AUTH_TOKENS);
        return tokensJson ? JSON.parse(tokensJson) : null;
    }
    async removeAuthTokens() {
        await this.adapter.removeItem(config_1.STORAGE_KEYS.AUTH_TOKENS);
    }
    async storeUser(user) {
        await this.adapter.setItem(config_1.STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    }
    async getUser() {
        const userJson = await this.adapter.getItem(config_1.STORAGE_KEYS.USER_DATA);
        return userJson ? JSON.parse(userJson) : null;
    }
    async removeUser() {
        await this.adapter.removeItem(config_1.STORAGE_KEYS.USER_DATA);
    }
    async storeSettings(settings) {
        await this.adapter.setItem(config_1.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
    async getSettings() {
        const settingsJson = await this.adapter.getItem(config_1.STORAGE_KEYS.SETTINGS);
        return settingsJson ? JSON.parse(settingsJson) : null;
    }
    async storeQueryHistory(history) {
        await this.adapter.setItem(config_1.STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(history));
    }
    async getQueryHistory() {
        const historyJson = await this.adapter.getItem(config_1.STORAGE_KEYS.QUERY_HISTORY);
        return historyJson ? JSON.parse(historyJson) : [];
    }
    async clearAll() {
        await this.adapter.clear();
    }
    // Direct adapter access for legacy compatibility
    async setItem(key, value) {
        await this.adapter.setItem(key, value);
    }
    async getItem(key) {
        return await this.adapter.getItem(key);
    }
    async removeItem(key) {
        await this.adapter.removeItem(key);
    }
}
exports.StorageService = StorageService;
//# sourceMappingURL=base.js.map