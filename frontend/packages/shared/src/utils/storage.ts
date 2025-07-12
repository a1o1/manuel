import { getStorageService } from '../platform';

// Get the storage keys from constants
let STORAGE_KEYS: any;
try {
  STORAGE_KEYS = require('../constants').STORAGE_KEYS;
} catch {
  // Fallback for when constants are not available
  STORAGE_KEYS = {
    AUTH_TOKENS: '@manuel:auth_tokens',
    USER_DATA: '@manuel:user_data',
  };
}

// Legacy wrapper for backward compatibility
export class SecureStorage {
  private static getStorageService() {
    return getStorageService();
  }

  static async setItem(key: string, value: string): Promise<void> {
    try {
      const storageService = this.getStorageService();
      await storageService.adapter.setItem(key, value);
    } catch (error) {
      console.error('Error storing secure item:', error);
      throw error;
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      const storageService = this.getStorageService();
      return await storageService.adapter.getItem(key);
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      const storageService = this.getStorageService();
      await storageService.adapter.removeItem(key);
    } catch (error) {
      console.error('Error removing secure item:', error);
      throw error;
    }
  }

  static async clear(): Promise<void> {
    try {
      const storageService = this.getStorageService();
      await storageService.clearAll();
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw error;
    }
  }
}

// Auth token storage using platform-agnostic service
export const AuthStorage = {
  async storeTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }): Promise<void> {
    const storageService = getStorageService();
    await storageService.storeAuthTokens(tokens);
  },

  async getTokens(): Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
  } | null> {
    const storageService = getStorageService();
    return await storageService.getAuthTokens();
  },

  async removeTokens(): Promise<void> {
    const storageService = getStorageService();
    await storageService.removeAuthTokens();
  },
};

// User data storage using platform-agnostic service
export const UserStorage = {
  async storeUser(user: any): Promise<void> {
    const storageService = getStorageService();
    await storageService.storeUser(user);
  },

  async getUser(): Promise<any | null> {
    const storageService = getStorageService();
    return await storageService.getUser();
  },

  async removeUser(): Promise<void> {
    const storageService = getStorageService();
    await storageService.removeUser();
  },
};
