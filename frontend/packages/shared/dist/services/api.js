"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiService = void 0;
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../constants");
const storage_1 = require("../utils/storage");
const utils_1 = require("../utils");
const auth_1 = require("./auth");
class ApiService {
    constructor() {
        this.client = axios_1.default.create({
            baseURL: constants_1.API_CONFIG.BASE_URL,
            timeout: constants_1.API_CONFIG.TIMEOUT,
            headers: {
                'Content-Type': 'application/json',
            },
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        // Request interceptor to add auth token
        this.client.interceptors.request.use(async (config) => {
            const tokens = await storage_1.AuthStorage.getTokens();
            if (tokens?.idToken) {
                config.headers.Authorization = `Bearer ${tokens.idToken}`;
            }
            return config;
        }, (error) => {
            return Promise.reject(error);
        });
        // Response interceptor for error handling
        this.client.interceptors.response.use((response) => response, async (error) => {
            // Handle authentication errors (401)
            if (error.response?.status === 401 && !error.config._retry) {
                // Token expired, try to refresh (but only once)
                error.config._retry = true;
                try {
                    await this.refreshTokens();
                    // Retry the original request with fresh token
                    const tokens = await storage_1.AuthStorage.getTokens();
                    if (tokens?.idToken) {
                        error.config.headers.Authorization = `Bearer ${tokens.idToken}`;
                    }
                    return this.client.request(error.config);
                }
                catch (refreshError) {
                    // Refresh failed, clear tokens and throw error
                    await storage_1.AuthStorage.removeTokens();
                    throw new Error('Authentication failed. Please log in again.');
                }
            }
            // Handle rate limiting (429) with automatic retry
            if (error.response?.status === 429 && !error.config._rateLimitRetry && constants_1.API_CONFIG.SECURITY.ENABLE_RETRY_ON_RATE_LIMIT) {
                error.config._rateLimitRetry = true;
                // Extract retry-after from response (in seconds)
                const retryAfter = Math.max(parseInt(error.response.headers['retry-after'] || '0', 10), error.response.data?.retry_after || 60);
                // Only retry if the wait time is reasonable (configurable max wait time)
                if (retryAfter <= constants_1.API_CONFIG.RATE_LIMIT.MAX_RETRY_WAIT) {
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
        });
    }
    async refreshTokens() {
        try {
            // Use Cognito auth service to refresh tokens
            const newTokens = await auth_1.authService.refreshTokens();
            // Store the refreshed tokens
            await storage_1.AuthStorage.storeTokens({
                accessToken: newTokens.AccessToken,
                refreshToken: newTokens.RefreshToken,
                idToken: newTokens.IdToken,
            });
        }
        catch (error) {
            // If refresh fails, the user needs to log in again
            throw new Error('Failed to refresh tokens');
        }
    }
    // Generic HTTP methods
    async get(url, config) {
        try {
            const response = await this.client.get(url, config);
            return response.data;
        }
        catch (error) {
            // Create an error that preserves the original response data
            const errorMessage = (0, utils_1.handleApiError)(error);
            const enhancedError = new Error(errorMessage);
            // Preserve the original error structure for debugging
            if (error.response) {
                enhancedError.response = error.response;
            }
            if (error.code) {
                enhancedError.code = error.code;
            }
            throw enhancedError;
        }
    }
    async post(url, data, config) {
        try {
            const response = await this.client.post(url, data, config);
            return response.data;
        }
        catch (error) {
            // Debug logging
            console.error('[API] POST request failed:', url);
            console.error('[API] Error status:', error?.response?.status);
            console.error('[API] Error data:', error?.response?.data);
            // Create an error that preserves the original response data
            const errorMessage = (0, utils_1.handleApiError)(error);
            const enhancedError = new Error(errorMessage);
            // Preserve the original error structure for debugging
            if (error.response) {
                enhancedError.response = error.response;
            }
            if (error.code) {
                enhancedError.code = error.code;
            }
            throw enhancedError;
        }
    }
    async put(url, data, config) {
        try {
            const response = await this.client.put(url, data, config);
            return response.data;
        }
        catch (error) {
            // Create an error that preserves the original response data
            const errorMessage = (0, utils_1.handleApiError)(error);
            const enhancedError = new Error(errorMessage);
            // Preserve the original error structure for debugging
            if (error.response) {
                enhancedError.response = error.response;
            }
            if (error.code) {
                enhancedError.code = error.code;
            }
            throw enhancedError;
        }
    }
    async delete(url, config) {
        try {
            const response = await this.client.delete(url, config);
            return response.data;
        }
        catch (error) {
            // Create an error that preserves the original response data
            const errorMessage = (0, utils_1.handleApiError)(error);
            const enhancedError = new Error(errorMessage);
            // Preserve the original error structure for debugging
            if (error.response) {
                enhancedError.response = error.response;
            }
            if (error.code) {
                enhancedError.code = error.code;
            }
            throw enhancedError;
        }
    }
    // File upload with progress
    async uploadFile(url, data, onProgress) {
        try {
            const response = await this.client.post(url, data, {
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
        }
        catch (error) {
            // Create an error that preserves the original response data
            const errorMessage = (0, utils_1.handleApiError)(error);
            const enhancedError = new Error(errorMessage);
            // Preserve the original error structure for debugging
            if (error.response) {
                enhancedError.response = error.response;
            }
            if (error.code) {
                enhancedError.code = error.code;
            }
            throw enhancedError;
        }
    }
    // Set authentication token
    setAuthToken(token) {
        this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    // Remove authentication token
    removeAuthToken() {
        delete this.client.defaults.headers.common.Authorization;
    }
}
// Export singleton instance
exports.apiService = new ApiService();
//# sourceMappingURL=api.js.map