import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from '../constants';
import { AuthStorage } from '../utils/storage';
import { handleApiError } from '../utils';
import { authService } from './auth';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const tokens = await AuthStorage.getTokens();
        if (tokens?.idToken) {
          config.headers.Authorization = `Bearer ${tokens.idToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        // Handle authentication errors (401)
        if (error.response?.status === 401 && !error.config._retry) {
          // Token expired, try to refresh (but only once)
          error.config._retry = true;

          try {
            await this.refreshTokens();
            // Retry the original request with fresh token
            const tokens = await AuthStorage.getTokens();
            if (tokens?.idToken) {
              error.config.headers.Authorization = `Bearer ${tokens.idToken}`;
            }
            return this.client.request(error.config);
          } catch (refreshError) {
            // Refresh failed, clear tokens and throw error
            await AuthStorage.removeTokens();
            throw new Error('Authentication failed. Please log in again.');
          }
        }

        // Handle rate limiting (429) with automatic retry
        if (error.response?.status === 429 && !error.config._rateLimitRetry && API_CONFIG.SECURITY.ENABLE_RETRY_ON_RATE_LIMIT) {
          error.config._rateLimitRetry = true;

          // Extract retry-after from response (in seconds)
          const retryAfter = Math.max(
            parseInt(error.response.headers['retry-after'] || '0', 10),
            error.response.data?.retry_after || 60
          );

          // Only retry if the wait time is reasonable (configurable max wait time)
          if (retryAfter <= API_CONFIG.RATE_LIMIT.MAX_RETRY_WAIT) {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(this.client.request(error.config));
              }, retryAfter * 1000);
            });
          }
        }

        // Handle network timeouts with exponential backoff
        if ((error.code === 'ECONNABORTED' || error.message?.includes('timeout')) &&
            !error.config._timeoutRetry) {
          error.config._timeoutRetry = true;

          // Retry after a short delay
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              this.client.request(error.config)
                .then(resolve)
                .catch(reject);
            }, 2000); // 2 second delay for timeout retries
          });
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshTokens(): Promise<void> {
    try {
      // Use Cognito auth service to refresh tokens
      const newTokens = await authService.refreshTokens();

      // Store the refreshed tokens
      await AuthStorage.storeTokens({
        accessToken: newTokens.AccessToken,
        refreshToken: newTokens.RefreshToken,
        idToken: newTokens.IdToken,
      });
    } catch (error) {
      // If refresh fails, the user needs to log in again
      throw new Error('Failed to refresh tokens');
    }
  }

  // Generic HTTP methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, config);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async post<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data, config);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async put<T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data, config);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url, config);
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // File upload with progress
  async uploadFile<T = any>(
    url: string,
    data: FormData,
    onProgress?: (progress: number) => void
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(Math.round(progress));
          }
        },
      });
      return response.data;
    } catch (error) {
      throw new Error(handleApiError(error));
    }
  }

  // Set authentication token
  setAuthToken(token: string): void {
    this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  // Remove authentication token
  removeAuthToken(): void {
    delete this.client.defaults.headers.common.Authorization;
  }
}

// Export singleton instance
export const apiService = new ApiService();
