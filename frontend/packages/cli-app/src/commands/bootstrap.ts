import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiService } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';
import { requireAuth } from '../utils/auth';

export class BootstrapCommand {
  static register(program: Command) {
    const bootstrap = new BootstrapCommand();

    program
      .command('populate')
      .description('Reprocess existing manuals in S3 (triggers Knowledge Base ingestion)')
      .action(async () => {
        await handleError(() => bootstrap.populate());
      });

    program
      .command('clear')
      .description('Clear all bootstrap sample manuals')
      .action(async () => {
        await handleError(() => bootstrap.clear());
      });

    program
      .command('status')
      .description('Check bootstrap status')
      .action(async () => {
        await handleError(() => bootstrap.status());
      });
  }

  async populate() {
    await requireAuth();

    console.log(chalk.blue('🚀 Bootstrap System\n'));

    const spinner = ora('Scanning S3 for existing manuals and triggering Knowledge Base ingestion...').start();

    try {
      const response = await apiService.post<any>('/api/bootstrap', {
        action: 'populate'
      });

      spinner.succeed(chalk.green('Knowledge Base ingestion triggered for existing manuals!'));

      console.log(chalk.bold('\n📚 Found Manuals:'));
      response.manuals.forEach((manual: any, index: number) => {
        console.log(chalk.gray(`${index + 1}. ${manual.s3_key} (${(manual.size / 1024 / 1024).toFixed(1)} MB)`));
      });

      console.log(chalk.bold(`\n✅ Total: ${response.found_manuals} manuals found, ${response.ingestion_jobs} ingestion jobs started`));
      
      if (response.skipped_files > 0) {
        console.log(chalk.yellow(`⏭️  Skipped: ${response.skipped_files} files (already ingested)`));
        if (response.skipped && response.skipped.length > 0) {
          console.log(chalk.gray('\nSkipped files:'));
          response.skipped.forEach((skipped: any, index: number) => {
            console.log(chalk.gray(`${index + 1}. ${skipped.s3_key} - ${skipped.reason}`));
          });
        }
      }
      console.log(chalk.yellow('\n⏳ Note: Knowledge Base ingestion may take 5-10 minutes to complete.'));
      console.log(chalk.gray('   You can check processing status with: manuel manuals list'));

    } catch (error) {
      spinner.fail('Failed to populate sample manuals');
      throw new CLIError(`Bootstrap populate failed: ${error}`);
    }
  }

  async clear() {
    await requireAuth();

    console.log(chalk.blue('🧹 Clear Bootstrap Data\n'));

    const spinner = ora('Clearing bootstrap sample manuals...').start();

    try {
      const response = await apiService.post<any>('/api/bootstrap', {
        action: 'clear'
      });

      spinner.succeed(chalk.green('Bootstrap manuals cleared successfully!'));

      console.log(chalk.bold(`\n✅ Removed: ${response.deleted_count} bootstrap manuals`));

    } catch (error) {
      spinner.fail('Failed to clear bootstrap manuals');
      throw new CLIError(`Bootstrap clear failed: ${error}`);
    }
  }

  async status() {
    await requireAuth();

    console.log(chalk.blue('📊 Bootstrap Status\n'));

    const spinner = ora('Checking bootstrap status...').start();

    try {
      const response = await apiService.post<any>('/api/bootstrap', {
        action: 'status'
      });

      spinner.succeed('Bootstrap status retrieved');

      console.log(chalk.bold('\n📊 System Status:'));
      console.log(chalk.gray(`User ID: ${response.user_id}`));
      console.log(chalk.gray(`Total manuals: ${response.total_manuals}`));
      console.log(chalk.gray(`Bootstrap manuals: ${response.bootstrap_manuals}`));
      
      if (response.has_bootstrap_data) {
        console.log(chalk.green('\n✅ System has bootstrap data'));
      } else {
        console.log(chalk.yellow('\n⚠️  No bootstrap data found'));
        console.log(chalk.gray('   Run "manuel bootstrap populate" to add sample manuals'));
      }

    } catch (error) {
      spinner.fail('Failed to get bootstrap status');
      throw new CLIError(`Bootstrap status failed: ${error}`);
    }
  }
}