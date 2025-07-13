import chalk from 'chalk';

export class CLIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CLIError';
  }
}

export async function handleError<T>(fn: () => Promise<T>): Promise<T | void> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof CLIError) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else if (error instanceof Error) {
      // Enhanced error handling for security and rate limiting
      const message = error.message;

      if (message.includes('Rate limit exceeded')) {
        console.error(chalk.yellow(`⏱️  ${message}`));
        console.log(chalk.gray('💡 Tip: Try spacing out your requests or check if you have multiple CLI instances running.'));
        console.log(chalk.gray('   Rate limit: 50 requests per 15-minute window'));
      } else if (message.includes('Access denied') || message.includes('IP not allowed')) {
        console.error(chalk.red(`🚫 ${message}`));
        console.log(chalk.gray('💡 Tip: This may be due to network restrictions. Contact your administrator if needed.'));
      } else if (message.includes('Invalid input detected')) {
        console.error(chalk.red(`⚠️  ${message}`));
        console.log(chalk.gray('💡 Tip: Check for special characters, file format, or content that might trigger validation.'));
      } else if (message.includes('Request size exceeds')) {
        console.error(chalk.red(`📦 ${message}`));
        console.log(chalk.gray('💡 Tip: Try reducing file size or splitting large requests into smaller chunks.'));
      } else if (message.includes('Authentication failed')) {
        console.error(chalk.red(`🔐 ${message}`));
        console.log(chalk.gray('💡 Tip: Run "manuel login" to authenticate again.'));
      } else if (message.includes('Request timed out')) {
        console.error(chalk.yellow(`⏰ ${message}`));
        console.log(chalk.gray('💡 Tip: Check your internet connection or try again later.'));
      } else if (message.includes('Network error')) {
        console.error(chalk.red(`🌐 ${message}`));
        console.log(chalk.gray('💡 Tip: Verify your internet connection and try again.'));
      } else {
        // Default error handling
        console.error(chalk.red(`Error: ${message}`));
      }

      if (process.env.VERBOSE === 'true') {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`Unknown error: ${error}`));
    }
    process.exit(1);
  }
}
