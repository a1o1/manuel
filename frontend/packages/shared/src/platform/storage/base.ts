// Abstract storage interface that both platforms can implement
export interface StorageAdapter {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Import storage keys from constants
import { STORAGE_KEYS } from '../../constants/config';

// Platform-agnostic storage service
export class StorageService {
  constructor(private adapter: StorageAdapter) {}

  async storeAuthTokens(tokens: {
    accessToken: string;
    refreshToken: string;
    idToken: string;
  }): Promise<void> {
    await this.adapter.setItem(STORAGE_KEYS.AUTH_TOKENS, JSON.stringify(tokens));
  }

  async getAuthTokens(): Promise<{
    accessToken: string;
    refreshToken: string;
    idToken: string;
  } | null> {
    const tokensJson = await this.adapter.getItem(STORAGE_KEYS.AUTH_TOKENS);
    return tokensJson ? JSON.parse(tokensJson) : null;
  }

  async removeAuthTokens(): Promise<void> {
    await this.adapter.removeItem(STORAGE_KEYS.AUTH_TOKENS);
  }

  async storeUser(user: any): Promise<void> {
    await this.adapter.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  }

  async getUser(): Promise<any | null> {
    const userJson = await this.adapter.getItem(STORAGE_KEYS.USER_DATA);
    return userJson ? JSON.parse(userJson) : null;
  }

  async removeUser(): Promise<void> {
    await this.adapter.removeItem(STORAGE_KEYS.USER_DATA);
  }

  async storeSettings(settings: any): Promise<void> {
    await this.adapter.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  async getSettings(): Promise<any | null> {
    const settingsJson = await this.adapter.getItem(STORAGE_KEYS.SETTINGS);
    return settingsJson ? JSON.parse(settingsJson) : null;
  }

  async storeQueryHistory(history: any[]): Promise<void> {
    await this.adapter.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(history));
  }

  async getQueryHistory(): Promise<any[]> {
    const historyJson = await this.adapter.getItem(STORAGE_KEYS.QUERY_HISTORY);
    return historyJson ? JSON.parse(historyJson) : [];
  }

  async clearAll(): Promise<void> {
    await this.adapter.clear();
  }

  // Direct adapter access for legacy compatibility
  async setItem(key: string, value: string): Promise<void> {
    await this.adapter.setItem(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    return await this.adapter.getItem(key);
  }

  async removeItem(key: string): Promise<void> {
    await this.adapter.removeItem(key);
  }
}
