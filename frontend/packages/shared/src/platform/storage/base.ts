// Abstract storage interface that both platforms can implement
export interface StorageAdapter {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Storage keys used across platforms
export const STORAGE_KEYS = {
  AUTH_TOKENS: '@manuel:auth_tokens',
  USER_DATA: '@manuel:user_data',
  SETTINGS: '@manuel:settings',
  QUERY_HISTORY: '@manuel:query_history',
  LAST_SESSION: '@manuel:last_session',
  CLI_CONFIG: '@manuel:cli_config',
} as const;

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
}
