import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { manualService } from '@manuel/shared';
import { getFileService } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';
import { formatFileSize, formatRelativeTime } from '../utils/formatting';
import { requireAuth } from '../utils/auth';
import { validateUrl } from '../utils/validation';

export class ManualsCommand {
  private fileService = getFileService();

  static register(program: Command) {
    const manuals = new ManualsCommand();

    program
      .command('list')
      .alias('ls')
      .description('List all your manuals')
      .option('--json', 'Output as JSON')
      .option('-v, --verbose', 'Show detailed information')
      .action(async (options) => {
        await handleError(() => manuals.list(options));
      });

    program
      .command('upload <file>')
      .description('Upload a manual file')
      .option('-n, --name <name>', 'Custom name for the manual')
      .action(async (file, options) => {
        await handleError(() => manuals.upload(file, options));
      });

    program
      .command('download <url>')
      .alias('url')
      .description('Download a manual from URL')
      .option('-n, --name <name>', 'Custom filename')
      .action(async (url, options) => {
        await handleError(() => manuals.download(url, options));
      });

    program
      .command('delete <key>')
      .alias('rm')
      .description('Delete a manual')
      .option('-f, --force', 'Skip confirmation prompt')
      .action(async (key, options) => {
        await handleError(() => manuals.delete(key, options));
      });

    program
      .command('info <key>')
      .description('Show detailed information about a manual')
      .action(async (key) => {
        await handleError(() => manuals.info(key));
      });

    program
      .command('search <term>')
      .description('Search for manuals by name')
      .action(async (term) => {
        await handleError(() => manuals.search(term));
      });

    program
      .command('interactive')
      .description('Interactive manual management')
      .action(async () => {
        await handleError(() => manuals.interactive());
      });
  }

  async list(options: any = {}) {
    await requireAuth();

    const spinner = ora('Loading manuals...').start();

    try {
      // Add progress indication for long-running requests
      const timeout = setTimeout(() => {
        spinner.text = 'Still loading... (this may take up to 30 seconds)';
      }, 5000);

      const { manuals, count } = await manualService.getManuals();

      clearTimeout(timeout);

      spinner.succeed(`Found ${count} manual${count !== 1 ? 's' : ''}`);

      if (count === 0) {
        console.log(chalk.yellow('\nNo manuals found.'));
        console.log(chalk.gray('Use "manuel upload <file>" or "manuel download <url>" to add manuals.'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(manuals, null, 2));
        return;
      }

      // Create table
      const tableData = [
        ['Name', 'Size', 'Modified', 'Key']
      ];

      manuals.forEach(manual => {
        tableData.push([
          chalk.white(manual.name),
          chalk.gray(formatFileSize(manual.size)),
          chalk.gray(formatRelativeTime(manual.upload_date)),
          options.verbose ? chalk.gray(manual.id) : chalk.gray(manual.id.substring(0, 20) + '...')
        ]);
      });

      console.log('\n' + table(tableData, {
        border: {
          topBody: '─',
          topJoin: '┬',
          topLeft: '┌',
          topRight: '┐',
          bottomBody: '─',
          bottomJoin: '┴',
          bottomLeft: '└',
          bottomRight: '┘',
          bodyLeft: '│',
          bodyRight: '│',
          bodyJoin: '│',
          joinBody: '─',
          joinLeft: '├',
          joinRight: '┤',
          joinJoin: '┼'
        }
      }));

    } catch (error) {
      spinner.fail('Failed to load manuals');

      // Check if it's a timeout error
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
        throw new CLIError('Request timed out. The API may be experiencing delays. Please try again.');
      }

      throw new CLIError(`Failed to load manuals: ${error}`);
    }
  }

  async upload(filePath: string, options: any = {}) {
    await requireAuth();

    console.log(chalk.blue('📄 Upload Manual\n'));

    // Validate file exists
    const fileExists = await this.fileService.fileExists(filePath);
    if (!fileExists) {
      throw new CLIError(`File not found: ${filePath}`);
    }

    const spinner = ora('Preparing file...').start();

    try {
      // Get file info
      const fileInfo = await this.fileService.getFileInfo(filePath);
      if (!fileInfo) {
        throw new CLIError('Unable to read file information');
      }

      // Create file selection object
      const fileSelection = {
        uri: filePath,
        name: options.name || filePath.split('/').pop() || 'unknown',
        size: fileInfo.size,
        type: fileInfo.type,
        lastModified: fileInfo.lastModified,
      };

      // Validate file
      const validation = await this.fileService.validateFile(fileSelection);
      if (!validation.isValid) {
        spinner.fail('File validation failed');
        throw new CLIError(`Invalid file: ${validation.errors.join(', ')}`);
      }

      spinner.text = 'Reading file...';

      // Convert to base64
      const base64Content = await this.fileService.convertFileToBase64(fileSelection);

      spinner.text = 'Uploading...';

      // Upload to backend
      const result = await manualService.uploadManual({
        file_name: fileSelection.name,
        file_data: base64Content,
        content_type: fileSelection.type,
      });

      spinner.succeed(chalk.green('Manual uploaded successfully!'));

      console.log(chalk.gray(`Name: ${result.file_name}`));
      console.log(chalk.gray(`Key: ${result.key}`));
      console.log(chalk.gray(`Status: ${result.status}`));

      if (result.size_bytes) {
        console.log(chalk.gray(`Size: ${formatFileSize(result.size_bytes)}`));
      }

      console.log(chalk.yellow('\n📚 Manual is being processed and will be available for queries shortly.'));

    } catch (error) {
      spinner.fail('Upload failed');
      throw new CLIError(`Upload failed: ${error}`);
    }
  }

  async download(url: string, options: any = {}) {
    await requireAuth();

    console.log(chalk.blue('🌐 Download Manual from URL\n'));

    // Validate URL
    if (!validateUrl(url)) {
      throw new CLIError('Invalid URL. Please provide a valid HTTPS URL.');
    }

    const spinner = ora('Downloading from URL...').start();

    try {
      console.log(chalk.gray(`\nAttempting to download from: ${url}`));
      if (options.name) {
        console.log(chalk.gray(`Custom filename: ${options.name}`));
      }

      const result = await manualService.downloadManual({
        url,
        filename: options.name,
      });

      spinner.succeed(chalk.green('Manual downloaded and uploaded successfully!'));

      // Handle the actual backend response format with type assertion
      const response = result as any;
      const fileName = response.file_name || response.filename || options.name || 'Unknown Manual';
      const key = response.key || response.manual_id || response.s3_key || 'Unknown';
      const size = response.size_bytes || response.size || 0;
      const downloadTime = response.download_time_ms || 'Unknown';

      console.log(chalk.gray(`Name: ${fileName}`));
      console.log(chalk.gray(`ID: ${key}`));
      if (size > 0) {
        console.log(chalk.gray(`Size: ${formatFileSize(size)}`));
      }
      if (downloadTime !== 'Unknown') {
        console.log(chalk.gray(`Download time: ${downloadTime}ms`));
      }

      // Display the success message from backend if available
      if (response.message) {
        console.log(chalk.green(`\n${response.message}`));
      }

      if (response.security_warnings && response.security_warnings.length > 0) {
        console.log(chalk.yellow('\n⚠️ Security warnings:'));
        response.security_warnings.forEach((warning: string) => {
          console.log(chalk.yellow(`  • ${warning}`));
        });
      }

      console.log(chalk.yellow('\n📚 Manual is being processed and will be available for queries shortly.'));

    } catch (error: any) {
      spinner.fail('Download failed');

      // Log detailed error information for debugging
      console.error(chalk.red('\nFull error object:'), error);

      if (error?.response) {
        console.error(chalk.red('\nError response details:'));
        console.error(chalk.gray(`Status: ${error.response.status}`));
        console.error(chalk.gray(`Status Text: ${error.response.statusText}`));
        if (error.response.data) {
          console.error(chalk.gray(`Response: ${JSON.stringify(error.response.data, null, 2)}`));
        }
      } else {
        console.error(chalk.yellow('\nNo response property in error'));
      }

      // Extract the most meaningful error message
      let errorMessage = 'Unknown error';
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
        // Check if there are additional details
        if (error.response.data.details) {
          errorMessage += ` - ${error.response.data.details}`;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      throw new CLIError(`Download failed: ${errorMessage}`);
    }
  }

  async delete(key: string, options: any = {}) {
    await requireAuth();

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete this manual?`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Deletion cancelled.'));
        return;
      }
    }

    const spinner = ora('Deleting manual...').start();

    try {
      const result: any = await manualService.deleteManual(key);
      spinner.succeed(chalk.green('Manual deleted successfully!'));
      
      // Display cleanup summary if available
      if (result && typeof result === 'object' && 'cleanup_summary' in result) {
        const summary = (result as any).cleanup_summary;
        console.log(chalk.bold('\n🧹 Cleanup Summary:'));
        console.log(chalk.gray(`Completed: ${summary.completed_steps}/${summary.total_steps} steps`));
        
        const details = summary.details;
        if (details.s3_deletion) console.log(chalk.green('✅ S3 file deleted'));
        if (details.knowledge_base_sync) console.log(chalk.green('✅ Knowledge Base sync triggered'));
        if (details.file_tracking_cleanup) console.log(chalk.green('✅ File tracking cleaned up'));
        if (details.cache_invalidation) console.log(chalk.green(`✅ Cache invalidated (${details.cache_keys_deleted || 0} keys)`));
        if (details.pdf_page_cleanup) console.log(chalk.green(`✅ PDF pages cleaned up (${details.cached_pages_deleted || 0} pages)`));
        
        if (details.errors && details.errors.length > 0) {
          console.log(chalk.yellow('\n⚠️  Cleanup Warnings:'));
          details.errors.forEach((error: string) => {
            console.log(chalk.yellow(`  • ${error}`));
          });
        }
        
        if (details.sync_job_id) {
          console.log(chalk.blue(`\n🔄 Knowledge Base sync job: ${details.sync_job_id}`));
          console.log(chalk.gray('Note: It may take a few minutes for the manual to be completely removed from search results.'));
        }
      }

    } catch (error) {
      spinner.fail('Deletion failed');
      throw new CLIError(`Failed to delete manual: ${error}`);
    }
  }

  async info(key: string) {
    await requireAuth();

    const spinner = ora('Loading manual information...').start();

    try {
      const manual = await manualService.getManualMetadata(key);
      const status = await manualService.getProcessingStatus(key);

      spinner.succeed('Manual information loaded');

      console.log(chalk.bold('\n📄 Manual Information:'));
      console.log(chalk.white(`Name: ${manual.name}`));
      console.log(chalk.gray(`ID: ${manual.id}`));
      console.log(chalk.gray(`Size: ${formatFileSize(manual.size)}`));
      console.log(chalk.gray(`Uploaded: ${formatRelativeTime(manual.upload_date)}`));

      console.log(chalk.bold('\n🔄 Processing Status:'));
      console.log(chalk.gray(`Status: ${status.status}`));
      if (status.job_id) {
        console.log(chalk.gray(`Job ID: ${status.job_id}`));
      }
      if (status.created_at) {
        console.log(chalk.gray(`Created: ${formatRelativeTime(status.created_at)}`));
      }
      if (status.updated_at) {
        console.log(chalk.gray(`Updated: ${formatRelativeTime(status.updated_at)}`));
      }

    } catch (error) {
      spinner.fail('Failed to load manual information');
      throw new CLIError(`Failed to get manual info: ${error}`);
    }
  }

  async search(term: string) {
    await requireAuth();

    const spinner = ora('Searching manuals...').start();

    try {
      const { manuals } = await manualService.getManuals();

      const filtered = manuals.filter(manual =>
        manual.name.toLowerCase().includes(term.toLowerCase())
      );

      spinner.succeed(`Found ${filtered.length} matching manual${filtered.length !== 1 ? 's' : ''}`);

      if (filtered.length === 0) {
        console.log(chalk.yellow('\nNo manuals found matching your search.'));
        return;
      }

      // Display results
      filtered.forEach(manual => {
        console.log(chalk.white(`\n📄 ${manual.name}`));
        console.log(chalk.gray(`   Size: ${formatFileSize(manual.size)}`));
        console.log(chalk.gray(`   Uploaded: ${formatRelativeTime(manual.upload_date)}`));
        console.log(chalk.gray(`   ID: ${manual.id}`));
      });

    } catch (error) {
      spinner.fail('Search failed');
      throw new CLIError(`Search failed: ${error}`);
    }
  }

  async interactive() {
    await requireAuth();

    console.log(chalk.blue('📚 Interactive Manual Management\n'));

    while (true) {
      try {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '📋 List manuals', value: 'list' },
              { name: '📄 Upload manual', value: 'upload' },
              { name: '🌐 Download from URL', value: 'download' },
              { name: '🔍 Search manuals', value: 'search' },
              { name: '❌ Delete manual', value: 'delete' },
              { name: '🚪 Exit', value: 'exit' },
            ],
          },
        ]);

        if (action === 'exit') {
          console.log(chalk.green('\nGoodbye! 👋'));
          break;
        }

        switch (action) {
          case 'list':
            await this.list();
            break;

          case 'upload':
            const { filePath } = await inquirer.prompt([
              {
                type: 'input',
                name: 'filePath',
                message: 'File path:',
                validate: (input) => input.trim().length > 0 || 'Please enter a file path',
              },
            ]);
            await this.upload(filePath);
            break;

          case 'download':
            const { url } = await inquirer.prompt([
              {
                type: 'input',
                name: 'url',
                message: 'URL:',
                validate: (input) => validateUrl(input) || 'Please enter a valid HTTPS URL',
              },
            ]);
            await this.download(url);
            break;

          case 'search':
            const { searchTerm } = await inquirer.prompt([
              {
                type: 'input',
                name: 'searchTerm',
                message: 'Search term:',
                validate: (input) => input.trim().length > 0 || 'Please enter a search term',
              },
            ]);
            await this.search(searchTerm);
            break;

          case 'delete':
            // First show list, then ask which to delete
            await this.list();
            const { keyToDelete } = await inquirer.prompt([
              {
                type: 'input',
                name: 'keyToDelete',
                message: 'Manual key to delete:',
                validate: (input) => input.trim().length > 0 || 'Please enter a manual key',
              },
            ]);
            await this.delete(keyToDelete);
            break;
        }

        console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));

      } catch (error) {
        console.error(chalk.red(`Error: ${error}`));
        console.log(chalk.gray('\n' + '─'.repeat(50) + '\n'));
      }
    }
  }
}
