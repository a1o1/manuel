import chalk from 'chalk';
import { getStorageService } from '@manuel/shared';
import { CLIError } from './error';

const storageService = getStorageService();

export async function requireAuth(): Promise<void> {
  const tokens = await storageService.getAuthTokens();

  if (!tokens) {
    throw new CLIError(
      `Authentication required. Please run "${chalk.cyan('manuel auth login')}" first.`
    );
  }

  // TODO: Check if tokens are still valid
  // For now, we'll rely on the API to return 401 if tokens are expired
}
