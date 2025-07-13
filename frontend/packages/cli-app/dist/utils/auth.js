"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const chalk_1 = __importDefault(require("chalk"));
const shared_1 = require("@manuel/shared");
const error_1 = require("./error");
const storageService = (0, shared_1.getStorageService)();
async function requireAuth() {
    const tokens = await storageService.getAuthTokens();
    if (!tokens) {
        throw new error_1.CLIError(`Authentication required. Please run "${chalk_1.default.cyan('manuel auth login')}" first.`);
    }
    // Check if we have a valid session with Cognito
    try {
        const isAuthenticated = await shared_1.authService.isAuthenticated();
        if (!isAuthenticated) {
            // Try to refresh tokens
            try {
                const newTokens = await shared_1.authService.refreshTokens();
                await storageService.storeAuthTokens({
                    accessToken: newTokens.AccessToken,
                    refreshToken: newTokens.RefreshToken,
                    idToken: newTokens.IdToken,
                });
            }
            catch (refreshError) {
                // Refresh failed, user needs to log in again
                await storageService.removeAuthTokens();
                await storageService.removeUser();
                throw new error_1.CLIError(`Your session has expired. Please run "${chalk_1.default.cyan('manuel auth login')}" to sign in again.`);
            }
        }
    }
    catch (error) {
        // If we can't check authentication status, the user should log in again
        throw new error_1.CLIError(`Authentication verification failed. Please run "${chalk_1.default.cyan('manuel auth login')}" to sign in again.`);
    }
}
//# sourceMappingURL=auth.js.map
