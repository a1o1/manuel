import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { queryService } from '@manuel/shared';
import { getAudioService } from '@manuel/shared';
import type { AudioRecording } from '@manuel/shared/src/platform/audio/base';
import { CLIError, handleError } from '../utils/error';
import { formatDuration, formatRelativeTime } from '../utils/formatting';
import { requireAuth } from '../utils/auth';

export class QueryCommand {
  private audioService = getAudioService();

  static register(program: Command) {
    const query = new QueryCommand();

    program
      .command('ask <question>')
      .description('Ask a question about your manuals')
      .option('-s, --sources', 'Include sources in response')
      .option('-v, --verbose', 'Show detailed response information')
      .action(async (question, options) => {
        await handleError(() => query.ask(question, options));
      });

    program
      .command('voice')
      .description('Ask a question using voice input')
      .option('-s, --sources', 'Include sources in response')
      .option('-d, --duration <seconds>', 'Maximum recording duration', '30')
      .action(async (options) => {
        await handleError(() => query.voice(options));
      });

    program
      .command('history')
      .description('View query history')
      .option('-l, --limit <number>', 'Number of queries to show', '10')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await handleError(() => query.history(options));
      });

    program
      .command('interactive')
      .alias('chat')
      .description('Start interactive query session')
      .option('-s, --sources', 'Include sources in responses')
      .action(async (options) => {
        await handleError(() => query.interactive(options));
      });
  }

  async ask(question: string, options: any = {}) {
    await requireAuth();

    if (!question || question.trim().length === 0) {
      throw new CLIError('Question cannot be empty');
    }

    console.log(chalk.blue('🤔 Thinking...\n'));

    const spinner = ora('Processing your question...').start();

    try {
      // Add progress indication for long-running requests
      const timeout = setTimeout(() => {
        spinner.text = 'Still processing... (this may take up to 30 seconds)';
      }, 5000);

      const response = await queryService.textQuery(question, options.sources !== false);

      clearTimeout(timeout);

      spinner.succeed(chalk.green('Got an answer!'));

      // Display the response
      console.log(chalk.bold('\n📝 Answer:'));
      console.log(chalk.white(response.response));

      // Show sources if available and requested
      if (options.sources && response.sources && response.sources.length > 0) {
        console.log(chalk.bold('\n📚 Sources:'));
        response.sources.forEach((source, index) => {
          console.log(chalk.gray(`${index + 1}. ${source.metadata.source} (score: ${source.metadata.score.toFixed(2)})`));
          if (options.verbose) {
            console.log(chalk.gray(`   "${source.content.substring(0, 100)}..."`));
          }
        });
      }

      // Show usage info if available
      if (response.usage && options.verbose) {
        console.log(chalk.bold('\n📊 Usage:'));
        console.log(chalk.gray(`Daily queries: ${response.usage.daily_queries}/${response.usage.daily_limit}`));
        console.log(chalk.gray(`Monthly queries: ${response.usage.monthly_queries}/${response.usage.monthly_limit}`));
      }

      // Show cost info if available
      if (response.costs && options.verbose) {
        console.log(chalk.bold('\n💰 Cost:'));
        console.log(chalk.gray(`Total: $${response.costs.total_cost.toFixed(4)}`));
        console.log(chalk.gray(`Processing time: ${response.processing_time_ms}ms`));
      }

    } catch (error) {
      spinner.fail('Query failed');

      // Check if it's a timeout error
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
        throw new CLIError('Request timed out. The API may be experiencing delays. Please try again.');
      }

      throw new CLIError(`Failed to process question: ${error}`);
    }
  }

  async voice(options: any = {}) {
    await requireAuth();

    console.log(chalk.blue('🎤 Voice Query\n'));

    // Check audio permissions
    const hasPermission = await this.audioService.requestPermissions();
    if (!hasPermission) {
      throw new CLIError('Audio recording permission required for voice queries');
    }

    const maxDuration = parseInt(options.duration) || 30;

    console.log(chalk.yellow(`Press ENTER to start recording (max ${maxDuration}s)...`));
    await this.waitForEnter();

    const spinner = ora('Recording... (Press Ctrl+C to stop)').start();

    try {
      // Set up recording stop handler
      let recordingStopped = false;
      let recordingResult: AudioRecording | undefined;

      const stopRecording = async () => {
        if (!recordingStopped) {
          recordingStopped = true;
          spinner.text = 'Stopping recording...';
          recordingResult = await this.audioService.stopRecording();
          spinner.succeed(`Recorded ${formatDuration(recordingResult.duration)}`);
        }
      };

      // Start recording
      await this.audioService.startRecording({
        maxDuration,
        quality: 'high',
        channels: 1,
        sampleRate: 44100,
      });

      // Handle Ctrl+C
      process.on('SIGINT', stopRecording);

      // Auto-stop after duration
      setTimeout(async () => {
        await stopRecording();
      }, maxDuration * 1000);

      // Wait for recording to finish
      while (!recordingStopped) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!recordingResult) {
        throw new CLIError('Failed to record audio');
      }

      // Convert to base64 and send query
      spinner.start('Transcribing and processing...');

      const audioBase64 = await this.audioService.convertToBase64(recordingResult.uri);
      const audioFormat = this.audioService.getAudioFormat();

      const response = await queryService.voiceQuery(
        audioBase64,
        `audio/${audioFormat}`,
        options.sources !== false
      );

      spinner.succeed(chalk.green('Voice query processed!'));

      // Display the response (same as text query)
      console.log(chalk.bold('\n📝 Answer:'));
      console.log(chalk.white(response.response));

      if (options.sources && response.sources && response.sources.length > 0) {
        console.log(chalk.bold('\n📚 Sources:'));
        response.sources.forEach((source, index) => {
          console.log(chalk.gray(`${index + 1}. ${source.metadata.source} (score: ${source.metadata.score.toFixed(2)})`));
        });
      }

      // Cleanup
      await this.audioService.cleanup();

    } catch (error) {
      spinner.fail('Voice query failed');
      await this.audioService.cleanup();
      throw new CLIError(`Voice query failed: ${error}`);
    }
  }

  async history(options: any = {}) {
    await requireAuth();

    const spinner = ora('Loading query history...').start();

    try {
      // This would need to be implemented in the backend
      // For now, show a placeholder
      spinner.info('Query history feature coming soon!');
      console.log(chalk.gray('Future feature: View your recent queries and responses'));

    } catch (error) {
      spinner.fail('Failed to load history');
      throw new CLIError(`Failed to load query history: ${error}`);
    }
  }

  async interactive(options: any = {}) {
    await requireAuth();

    console.log(chalk.blue('💬 Interactive Query Mode\n'));
    console.log(chalk.gray('Ask questions about your manuals. Type "exit" to quit.\n'));

    while (true) {
      try {
        const { question } = await inquirer.prompt([
          {
            type: 'input',
            name: 'question',
            message: 'Your question:',
            validate: (input) => {
              if (input.trim().toLowerCase() === 'exit') {
                return true;
              }
              if (input.trim().length === 0) {
                return 'Please enter a question';
              }
              return true;
            },
          },
        ]);

        if (question.trim().toLowerCase() === 'exit') {
          console.log(chalk.green('\nGoodbye! 👋'));
          break;
        }

        await this.ask(question, options);
        console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));

      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));
      }
    }
  }

  private async waitForEnter(): Promise<void> {
    return new Promise((resolve) => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
  }
}
