import { getApiUrl } from '../../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/logger';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export class BaseApi {
  protected async getAuthToken(): Promise<string | null> {
    try {
      // Get tokens from the real auth service storage format
      const authData = await AsyncStorage.getItem('@manuel/auth_tokens');
      if (!authData) {
        logger.log('No auth tokens found in storage');
        return null;
      }

      const tokens = JSON.parse(authData);

      // Check if token is still valid (with 5 minute buffer)
      const now = Date.now();
      const buffer = 5 * 60 * 1000; // 5 minutes

      if (tokens.expiresAt <= now + buffer) {
        logger.log('Auth token has expired');
        return null;
      }

      const token = tokens.idToken;
      logger.log('Retrieved auth token:', token ? `${token.substring(0, 20)}...` : 'null');
      return token;
    } catch (error) {
      logger.error('Failed to retrieve auth token:', error);
      return null;
    }
  }

  protected async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = getApiUrl(endpoint);
      logger.log(`Making ${options.method || 'GET'} request to:`, url);
      logger.log('Request headers:', headers);
      logger.log('Request body:', options.body);

      const response = await fetch(url, {
        ...options,
        headers,
      });

      logger.log('Raw response status:', response.status);
      const data = await response.json().catch(() => null);
      logger.log(`Response status: ${response.status}`, data);

      if (!response.ok) {
        const errorMessage = data?.error || data?.message || `Request failed with status ${response.status}`;
        logger.error('API Error:', errorMessage);
        logger.error('Full error response:', {
          status: response.status,
          statusText: response.statusText,
          data,
          headers: Object.fromEntries(response.headers.entries())
        });
        return {
          error: errorMessage,
          status: response.status,
          data,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  protected async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  protected async post<T = any>(
    endpoint: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async put<T = any>(
    endpoint: string,
    body?: any
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'DELETE' });
  }
}
