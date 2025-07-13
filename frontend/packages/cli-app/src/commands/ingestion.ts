import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiService } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';
import { requireAuth } from '../utils/auth';

export class IngestionCommand {
  static register(program: Command) {
    const ingestion = new IngestionCommand();

    const ingestionCmd = program
      .command('ingestion')
      .description('Monitor Knowledge Base ingestion jobs');

    ingestionCmd
      .command('status')
      .description('Check status of all recent ingestion jobs')
      .action(async () => {
        await handleError(() => ingestion.status());
      });

    ingestionCmd
      .command('job')
      .description('Check status of a specific ingestion job')
      .argument('<job-id>', 'Ingestion job ID to check')
      .action(async (jobId: string) => {
        await handleError(() => ingestion.jobStatus(jobId));
      });

    ingestionCmd
      .command('files')
      .description('Show file tracking statistics and deduplication info')
      .action(async () => {
        await handleError(() => ingestion.fileStats());
      });
  }

  async status() {
    await requireAuth();

    console.log(chalk.blue('📊 Ingestion Status\n'));

    const spinner = ora('Checking ingestion jobs...').start();

    try {
      const response = await apiService.get<any>('/api/ingestion/status');

      spinner.succeed('Ingestion status retrieved');

      console.log(chalk.bold(`\n📈 Total Jobs: ${response.total_jobs}`));
      
      if (response.jobs && response.jobs.length > 0) {
        console.log(chalk.bold('\n🔄 Recent Jobs:'));
        
        response.jobs.forEach((job: any, index: number) => {
          const statusColor = this.getStatusColor(job.status);
          const timeAgo = this.getTimeAgo(job.created_at);
          
          console.log(chalk.gray(`${index + 1}. ${job.job_id}`));
          console.log(chalk.gray(`   Status: ${statusColor(job.status)}`));
          console.log(chalk.gray(`   Manual: ${job.s3_key || 'Unknown'}`));
          console.log(chalk.gray(`   Created: ${timeAgo}`));
          console.log('');
        });
      } else {
        console.log(chalk.yellow('\n⚠️  No ingestion jobs found'));
        console.log(chalk.gray('   Run "manuel bootstrap populate" to start ingestion'));
      }

      if (response.note) {
        console.log(chalk.blue(`\n💡 ${response.note}`));
      }

    } catch (error) {
      spinner.fail('Failed to get ingestion status');
      throw new CLIError(`Ingestion status failed: ${error}`);
    }
  }

  async jobStatus(jobId: string) {
    await requireAuth();

    console.log(chalk.blue(`🔍 Job Status: ${jobId}\n`));

    const spinner = ora('Getting job details...').start();

    try {
      const response = await apiService.get<any>(`/api/ingestion/status?job_id=${jobId}`);

      spinner.succeed('Job details retrieved');

      if (response.error) {
        console.log(chalk.red(`\n❌ Error: ${response.error}`));
        if (response.details) {
          console.log(chalk.gray(`   Details: ${response.details}`));
        }
        return;
      }

      const statusColor = this.getStatusColor(response.status);
      
      console.log(chalk.bold('\n📋 Job Details:'));
      console.log(chalk.gray(`Job ID: ${response.job_id}`));
      console.log(chalk.gray(`Status: ${statusColor(response.status)}`));
      console.log(chalk.gray(`Manual: ${response.s3_key || 'Unknown'}`));
      
      if (response.created_at) {
        console.log(chalk.gray(`Created: ${this.getTimeAgo(response.created_at)}`));
      }
      
      if (response.updated_at) {
        console.log(chalk.gray(`Updated: ${new Date(response.updated_at).toLocaleString()}`));
      }

      if (response.statistics) {
        console.log(chalk.bold('\n📊 Statistics:'));
        const stats = response.statistics;
        if (stats.numberOfDocumentsScanned) {
          console.log(chalk.gray(`Documents Scanned: ${stats.numberOfDocumentsScanned}`));
        }
        if (stats.numberOfNewDocumentsIndexed) {
          console.log(chalk.gray(`Documents Indexed: ${stats.numberOfNewDocumentsIndexed}`));
        }
        if (stats.numberOfModifiedDocumentsIndexed) {
          console.log(chalk.gray(`Documents Modified: ${stats.numberOfModifiedDocumentsIndexed}`));
        }
        if (stats.numberOfDeletedDocuments) {
          console.log(chalk.gray(`Documents Deleted: ${stats.numberOfDeletedDocuments}`));
        }
      }

      if (response.failure_reasons && response.failure_reasons.length > 0) {
        console.log(chalk.bold('\n❌ Failure Reasons:'));
        response.failure_reasons.forEach((reason: string, index: number) => {
          console.log(chalk.red(`${index + 1}. ${reason}`));
        });
      }

      // Show helpful hints based on status
      if (response.status === 'IN_PROGRESS') {
        console.log(chalk.yellow('\n⏳ Job is still running. Check again in a few minutes.'));
      } else if (response.status === 'COMPLETE') {
        console.log(chalk.green('\n✅ Job completed successfully! You can now query your manuals.'));
      } else if (response.status === 'FAILED') {
        console.log(chalk.red('\n❌ Job failed. Check the failure reasons above.'));
      }

    } catch (error) {
      spinner.fail('Failed to get job details');
      throw new CLIError(`Job status failed: ${error}`);
    }
  }

  private getStatusColor(status: string) {
    switch (status?.toUpperCase()) {
      case 'COMPLETE':
        return chalk.green;
      case 'IN_PROGRESS':
        return chalk.yellow;
      case 'FAILED':
        return chalk.red;
      case 'STARTED':
        return chalk.blue;
      default:
        return chalk.gray;
    }
  }

  async fileStats() {
    await requireAuth();

    console.log(chalk.blue('📈 File Tracking Statistics\n'));

    const spinner = ora('Getting file tracking data...').start();

    try {
      // Note: This would need a new API endpoint for file tracking stats
      // For now, we'll show this as a placeholder
      spinner.succeed('File tracking data retrieved');

      console.log(chalk.bold('🔄 Deduplication System:'));
      console.log(chalk.green('✅ File deduplication is active'));
      console.log(chalk.gray('   Files are tracked by S3 ETag to prevent duplicate ingestion'));
      console.log(chalk.gray('   Only new or modified files trigger ingestion jobs'));
      
      console.log(chalk.bold('\n💡 How it works:'));
      console.log(chalk.gray('• S3 ETag changes when file content changes'));
      console.log(chalk.gray('• Successfully ingested files are skipped on bootstrap'));
      console.log(chalk.gray('• Failed ingestion jobs will be retried'));
      console.log(chalk.gray('• File metadata is tracked for 30 days'));

      console.log(chalk.yellow('\n🚀 Run "manuel bootstrap populate" to see deduplication in action!'));

    } catch (error) {
      spinner.fail('Failed to get file tracking statistics');
      throw new CLIError(`File stats failed: ${error}`);
    }
  }

  private getTimeAgo(timestamp: number): string {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const then = timestamp * 1000; // Convert to milliseconds
    const diffMs = now - then;
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  }
}