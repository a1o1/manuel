import chalk from 'chalk';
import { getStorageService, authService } from '@manuel/shared';
import { CLIError } from './error';

const storageService = getStorageService();

export async function requireAuth(): Promise<void> {
  const tokens = await storageService.getAuthTokens();

  if (!tokens) {
    throw new CLIError(
      `Authentication required. Please run "${chalk.cyan('manuel auth login')}" first.`
    );
  }

  // Check if we have a valid session with Cognito
  try {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      // Try to refresh tokens
      try {
        const newTokens = await authService.refreshTokens();
        await storageService.storeAuthTokens({
          accessToken: newTokens.AccessToken,
          refreshToken: newTokens.RefreshToken,
          idToken: newTokens.IdToken,
        });
      } catch (refreshError) {
        // Refresh failed, user needs to log in again
        await storageService.removeAuthTokens();
        await storageService.removeUser();
        throw new CLIError(
          `Your session has expired. Please run "${chalk.cyan('manuel auth login')}" to sign in again.`
        );
      }
    }
  } catch (error) {
    // If we can't check authentication status, the user should log in again
    throw new CLIError(
      `Authentication verification failed. Please run "${chalk.cyan('manuel auth login')}" to sign in again.`
    );
  }
}
