import { StorageAdapter } from './base';

// React Native storage adapter using Expo SecureStore
export class ReactNativeStorageAdapter implements StorageAdapter {
  private SecureStore: any;

  constructor() {
    // Dynamic import to avoid issues when not in React Native environment
    try {
      this.SecureStore = require('expo-secure-store');
    } catch (error) {
      throw new Error('expo-secure-store is required for React Native storage');
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('Error storing secure item:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      return await this.SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('Error retrieving secure item:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await this.SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Error removing secure item:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      const { STORAGE_KEYS } = await import('./base');
      const keys = Object.values(STORAGE_KEYS);
      await Promise.all(keys.map(key => this.SecureStore.deleteItemAsync(key)));
    } catch (error) {
      console.error('Error clearing secure storage:', error);
      throw error;
    }
  }
}
