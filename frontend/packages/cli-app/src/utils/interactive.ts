import inquirer from 'inquirer';
import chalk from 'chalk';
import figlet from 'figlet';
import { AuthCommand } from '../commands/auth';
import { QueryCommand } from '../commands/query';
import { ManualsCommand } from '../commands/manuals';
import { UsageCommand } from '../commands/usage';
import { ConfigCommand } from '../commands/config';
import { getStorageService } from '@manuel/shared';
import { CLIError, handleError } from './error';

export class InteractiveMode {
  private storageService = getStorageService();
  private authCommand = new AuthCommand();
  private queryCommand = new QueryCommand();
  private manualsCommand = new ManualsCommand();
  private usageCommand = new UsageCommand();
  private configCommand = new ConfigCommand();

  async start() {
    console.clear();

    // Display welcome banner
    await this.showWelcome();

    // Check authentication status
    const isAuthenticated = await this.checkAuth();

    if (!isAuthenticated) {
      console.log(chalk.yellow('\n🔐 You need to be authenticated to use Manuel.'));
      const shouldLogin = await this.promptLogin();

      if (!shouldLogin) {
        console.log(chalk.gray('Goodbye!'));
        return;
      }

      await this.handleLogin();
    }

    // Main interactive loop
    await this.mainLoop();
  }

  private async showWelcome() {
    try {
      const banner = figlet.textSync('Manuel', {
        font: 'Small',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      });

      console.log(chalk.blue(banner));
      console.log(chalk.gray('Voice assistant for product manuals\n'));
    } catch {
      // Fallback if figlet fails
      console.log(chalk.blue.bold('Manuel CLI'));
      console.log(chalk.gray('Voice assistant for product manuals\n'));
    }
  }

  private async checkAuth(): Promise<boolean> {
    try {
      const tokens = await this.storageService.getAuthTokens();
      return !!tokens;
    } catch {
      return false;
    }
  }

  private async promptLogin(): Promise<boolean> {
    const { shouldLogin } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldLogin',
        message: 'Would you like to log in now?',
        default: true,
      },
    ]);

    return shouldLogin;
  }

  private async handleLogin() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Log in with existing account', value: 'login' },
          { name: 'Create new account', value: 'signup' },
          { name: 'Reset password', value: 'reset' },
        ],
      },
    ]);

    try {
      switch (action) {
        case 'login':
          await this.authCommand.login();
          break;
        case 'signup':
          await this.authCommand.signup();
          break;
        case 'reset':
          await this.authCommand.resetPassword();
          break;
      }

      console.log(chalk.green('\n✅ Authentication successful!'));
    } catch (error) {
      console.log(chalk.red('\n❌ Authentication failed.'));
      throw error;
    }
  }

  private async mainLoop() {
    while (true) {
      try {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '💬 Ask a question (text)', value: 'query_text' },
              { name: '🎤 Ask a question (voice)', value: 'query_voice' },
              { name: '📚 Manage manuals', value: 'manuals' },
              { name: '📊 View usage statistics', value: 'usage' },
              { name: '⚙️ Configure settings', value: 'config' },
              { name: '🔐 Authentication', value: 'auth' },
              new inquirer.Separator(),
              { name: '❌ Exit', value: 'exit' },
            ],
          },
        ]);

        switch (action) {
          case 'query_text':
            await this.handleTextQuery();
            break;
          case 'query_voice':
            await this.handleVoiceQuery();
            break;
          case 'manuals':
            await this.handleManuals();
            break;
          case 'usage':
            await this.handleUsage();
            break;
          case 'config':
            await this.handleConfig();
            break;
          case 'auth':
            await this.handleAuth();
            break;
          case 'exit':
            console.log(chalk.gray('\nGoodbye!'));
            return;
        }

        // Add spacing between actions
        console.log();

      } catch (error) {
        if (error instanceof CLIError) {
          console.log(chalk.red(`\n❌ ${error.message}`));
        } else {
          console.log(chalk.red('\n❌ An unexpected error occurred.'));
        }

        // Ask if user wants to continue
        const { shouldContinue } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldContinue',
            message: 'Would you like to continue?',
            default: true,
          },
        ]);

        if (!shouldContinue) {
          console.log(chalk.gray('Goodbye!'));
          return;
        }
      }
    }
  }

  private async handleTextQuery() {
    const { question } = await inquirer.prompt([
      {
        type: 'input',
        name: 'question',
        message: 'What would you like to know?',
        validate: (input) => input.trim().length > 0 || 'Please enter a question',
      },
    ]);

    const { includeSources } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'includeSources',
        message: 'Include source references in the response?',
        default: true,
      },
    ]);

    await handleError(() =>
      this.queryCommand.text(question, { sources: includeSources })
    );
  }

  private async handleVoiceQuery() {
    console.log(chalk.blue('\n🎤 Voice Query'));
    console.log(chalk.gray('Press Enter to start recording, press Enter again to stop.'));

    await inquirer.prompt([
      {
        type: 'input',
        name: 'start',
        message: 'Press Enter to start recording...',
      },
    ]);

    await handleError(() => this.queryCommand.voice({}));
  }

  private async handleManuals() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Manual management:',
        choices: [
          { name: 'List all manuals', value: 'list' },
          { name: 'Upload new manual', value: 'upload' },
          { name: 'Download manual from URL', value: 'download' },
          { name: 'Delete manual', value: 'delete' },
          { name: 'Interactive management', value: 'interactive' },
          { name: 'Back to main menu', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') return;

    switch (action) {
      case 'list':
        await handleError(() => this.manualsCommand.list());
        break;
      case 'upload':
        await this.handleManualUpload();
        break;
      case 'download':
        await this.handleManualDownload();
        break;
      case 'delete':
        await this.handleManualDelete();
        break;
      case 'interactive':
        await handleError(() => this.manualsCommand.interactive());
        break;
    }
  }

  private async handleManualUpload() {
    const { filePath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filePath',
        message: 'Enter the path to the manual file:',
        validate: (input) => input.trim().length > 0 || 'Please enter a file path',
      },
    ]);

    await handleError(() => this.manualsCommand.upload(filePath, {}));
  }

  private async handleManualDownload() {
    const { url } = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Enter the URL of the manual:',
        validate: (input) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      },
    ]);

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter a name for the manual (optional):',
      },
    ]);

    const options = name ? { name } : {};
    await handleError(() => this.manualsCommand.download(url, options));
  }

  private async handleManualDelete() {
    const { manualId } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualId',
        message: 'Enter the manual ID to delete:',
        validate: (input) => input.trim().length > 0 || 'Please enter a manual ID',
      },
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to delete manual "${manualId}"?`,
        default: false,
      },
    ]);

    if (confirm) {
      await handleError(() => this.manualsCommand.delete(manualId, { force: true }));
    } else {
      console.log(chalk.yellow('Delete cancelled.'));
    }
  }

  private async handleUsage() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Usage information:',
        choices: [
          { name: 'Overview / Statistics', value: 'overview' },
          { name: "Today's usage", value: 'today' },
          { name: 'Quota limits', value: 'quotas' },
          { name: 'Cost breakdown', value: 'costs' },
          { name: 'Usage history', value: 'history' },
          { name: 'Export usage data', value: 'export' },
          { name: 'Back to main menu', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') return;

    switch (action) {
      case 'overview':
        await handleError(() => this.usageCommand.overview());
        break;
      case 'today':
        await handleError(() => this.usageCommand.today());
        break;
      case 'quotas':
        await handleError(() => this.usageCommand.quotas());
        break;
      case 'costs':
        await this.handleCosts();
        break;
      case 'history':
        await this.handleHistory();
        break;
      case 'export':
        await this.handleExport();
        break;
    }
  }

  private async handleCosts() {
    const { period } = await inquirer.prompt([
      {
        type: 'list',
        name: 'period',
        message: 'Select time period:',
        choices: [
          { name: 'Daily', value: 'daily' },
          { name: 'Weekly', value: 'weekly' },
          { name: 'Monthly', value: 'monthly' },
        ],
      },
    ]);

    await handleError(() => this.usageCommand.costs({ period }));
  }

  private async handleHistory() {
    const { days } = await inquirer.prompt([
      {
        type: 'number',
        name: 'days',
        message: 'Number of days to show:',
        default: 7,
        validate: (input) => (input > 0 && input <= 365) || 'Must be between 1 and 365 days',
      },
    ]);

    await handleError(() => this.usageCommand.history({ days: days.toString() }));
  }

  private async handleExport() {
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'days',
        message: 'Number of days to export:',
        default: 30,
        validate: (input) => (input > 0 && input <= 365) || 'Must be between 1 and 365 days',
      },
      {
        type: 'list',
        name: 'format',
        message: 'Export format:',
        choices: [
          { name: 'CSV', value: 'csv' },
          { name: 'JSON', value: 'json' },
        ],
      },
      {
        type: 'input',
        name: 'output',
        message: 'Output file path (optional):',
      },
    ]);

    const options: any = { days: answers.days.toString(), format: answers.format };
    if (answers.output) {
      options.output = answers.output;
    }

    await handleError(() => this.usageCommand.export(options));
  }

  private async handleConfig() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Configuration:',
        choices: [
          { name: 'Show current configuration', value: 'show' },
          { name: 'Interactive setup', value: 'interactive' },
          { name: 'Set specific value', value: 'set' },
          { name: 'Get specific value', value: 'get' },
          { name: 'Reset to defaults', value: 'reset' },
          { name: 'Back to main menu', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') return;

    switch (action) {
      case 'show':
        await handleError(() => this.configCommand.show());
        break;
      case 'interactive':
        await handleError(() => this.configCommand.interactive());
        break;
      case 'set':
        await this.handleConfigSet();
        break;
      case 'get':
        await this.handleConfigGet();
        break;
      case 'reset':
        await this.handleConfigReset();
        break;
    }
  }

  private async handleConfigSet() {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: 'Which setting would you like to change?',
        choices: [
          { name: 'API URL', value: 'apiUrl' },
          { name: 'Default include sources', value: 'defaultIncludeSources' },
          { name: 'Default voice duration', value: 'defaultVoiceDuration' },
          { name: 'Verbose output', value: 'verboseOutput' },
          { name: 'Color output', value: 'colorOutput' },
        ],
      },
      {
        type: 'input',
        name: 'value',
        message: 'Enter the new value:',
        validate: (input) => input.trim().length > 0 || 'Please enter a value',
      },
    ]);

    await handleError(() => this.configCommand.set(answers.key, answers.value));
  }

  private async handleConfigGet() {
    const { key } = await inquirer.prompt([
      {
        type: 'list',
        name: 'key',
        message: 'Which setting would you like to view?',
        choices: [
          { name: 'API URL', value: 'apiUrl' },
          { name: 'Default include sources', value: 'defaultIncludeSources' },
          { name: 'Default voice duration', value: 'defaultVoiceDuration' },
          { name: 'Verbose output', value: 'verboseOutput' },
          { name: 'Color output', value: 'colorOutput' },
        ],
      },
    ]);

    await handleError(() => this.configCommand.get(key));
  }

  private async handleConfigReset() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to reset all settings to defaults?',
        default: false,
      },
    ]);

    if (confirm) {
      await handleError(() => this.configCommand.reset({ force: true }));
    } else {
      console.log(chalk.yellow('Reset cancelled.'));
    }
  }

  private async handleAuth() {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Authentication:',
        choices: [
          { name: 'Show status', value: 'status' },
          { name: 'Log in', value: 'login' },
          { name: 'Sign up', value: 'signup' },
          { name: 'Log out', value: 'logout' },
          { name: 'Reset password', value: 'reset' },
          { name: 'Back to main menu', value: 'back' },
        ],
      },
    ]);

    if (action === 'back') return;

    switch (action) {
      case 'status':
        await handleError(() => this.authCommand.status());
        break;
      case 'login':
        await handleError(() => this.authCommand.login());
        break;
      case 'signup':
        await handleError(() => this.authCommand.signup());
        break;
      case 'logout':
        await handleError(() => this.authCommand.logout());
        break;
      case 'reset':
        await handleError(() => this.authCommand.resetPassword());
        break;
    }
  }
}
