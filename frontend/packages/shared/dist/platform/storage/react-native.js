"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeStorageAdapter = void 0;
// React Native storage adapter using Expo SecureStore
class ReactNativeStorageAdapter {
    constructor() {
        // Dynamic import to avoid issues when not in React Native environment
        try {
            this.SecureStore = require('expo-secure-store');
        }
        catch (error) {
            throw new Error('expo-secure-store is required for React Native storage');
        }
    }
    async setItem(key, value) {
        try {
            await this.SecureStore.setItemAsync(key, value);
        }
        catch (error) {
            console.error('Error storing secure item:', error);
            throw error;
        }
    }
    async getItem(key) {
        try {
            return await this.SecureStore.getItemAsync(key);
        }
        catch (error) {
            console.error('Error retrieving secure item:', error);
            return null;
        }
    }
    async removeItem(key) {
        try {
            await this.SecureStore.deleteItemAsync(key);
        }
        catch (error) {
            console.error('Error removing secure item:', error);
            throw error;
        }
    }
    async clear() {
        try {
            const { STORAGE_KEYS } = await Promise.resolve().then(() => __importStar(require('../../constants/config')));
            const keys = Object.values(STORAGE_KEYS);
            await Promise.all(keys.map(key => this.SecureStore.deleteItemAsync(key)));
        }
        catch (error) {
            console.error('Error clearing secure storage:', error);
            throw error;
        }
    }
}
exports.ReactNativeStorageAdapter = ReactNativeStorageAdapter;
//# sourceMappingURL=react-native.js.map