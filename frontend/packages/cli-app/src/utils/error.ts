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
      console.error(chalk.red(`Error: ${error.message}`));
      if (process.env.VERBOSE === 'true') {
        console.error(chalk.gray(error.stack));
      }
    } else {
      console.error(chalk.red(`Unknown error: ${error}`));
    }
    process.exit(1);
  }
}
