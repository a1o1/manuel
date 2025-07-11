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
            throw new Error((0, utils_1.handleApiError)(error));
        }
    }
    async post(url, data, config) {
        try {
            const response = await this.client.post(url, data, config);
            return response.data;
        }
        catch (error) {
            throw new Error((0, utils_1.handleApiError)(error));
        }
    }
    async put(url, data, config) {
        try {
            const response = await this.client.put(url, data, config);
            return response.data;
        }
        catch (error) {
            throw new Error((0, utils_1.handleApiError)(error));
        }
    }
    async delete(url, config) {
        try {
            const response = await this.client.delete(url, config);
            return response.data;
        }
        catch (error) {
            throw new Error((0, utils_1.handleApiError)(error));
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
            throw new Error((0, utils_1.handleApiError)(error));
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
