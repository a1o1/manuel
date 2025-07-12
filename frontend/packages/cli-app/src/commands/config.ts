import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { getStorageService } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';

interface CLIConfig {
  apiUrl?: string;
  defaultIncludeSources?: boolean;
  defaultVoiceDuration?: number;
  verboseOutput?: boolean;
  colorOutput?: boolean;
}

export class ConfigCommand {
  private storageService = getStorageService();

  static register(program: Command) {
    const config = new ConfigCommand();

    program
      .command('show')
      .description('Show current configuration')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await handleError(() => config.show(options));
      });

    program
      .command('set <key> <value>')
      .description('Set a configuration value')
      .action(async (key, value) => {
        await handleError(() => config.set(key, value));
      });

    program
      .command('get <key>')
      .description('Get a configuration value')
      .action(async (key) => {
        await handleError(() => config.get(key));
      });

    program
      .command('reset')
      .description('Reset configuration to defaults')
      .option('-f, --force', 'Skip confirmation prompt')
      .action(async (options) => {
        await handleError(() => config.reset(options));
      });

    program
      .command('interactive')
      .description('Interactive configuration setup')
      .action(async () => {
        await handleError(() => config.interactive());
      });
  }

  async show(options: any = {}) {
    const spinner = ora('Loading configuration...').start();

    try {
      const config = await this.getConfig();

      spinner.succeed('Configuration loaded');

      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      console.log(chalk.bold('\n⚙️ Current Configuration:'));

      console.log(chalk.white(`API URL: ${config.apiUrl || 'default'}`));
      console.log(chalk.white(`Include sources by default: ${config.defaultIncludeSources ? 'yes' : 'no'}`));
      console.log(chalk.white(`Default voice duration: ${config.defaultVoiceDuration || 30}s`));
      console.log(chalk.white(`Verbose output: ${config.verboseOutput ? 'yes' : 'no'}`));
      console.log(chalk.white(`Color output: ${config.colorOutput !== false ? 'yes' : 'no'}`));

    } catch (error) {
      spinner.fail('Failed to load configuration');
      throw new CLIError(`Failed to load config: ${error}`);
    }
  }

  async set(key: string, value: string) {
    const spinner = ora('Updating configuration...').start();

    try {
      const config = await this.getConfig();

      // Validate and convert value
      const parsedValue = this.parseConfigValue(key, value);

      // Update config
      (config as any)[key] = parsedValue;

      // Save config
      await this.saveConfig(config);

      spinner.succeed(`Configuration updated: ${key} = ${parsedValue}`);

    } catch (error) {
      spinner.fail('Failed to update configuration');
      throw new CLIError(`Failed to set config: ${error}`);
    }
  }

  async get(key: string) {
    try {
      const config = await this.getConfig();
      const value = (config as any)[key];

      if (value === undefined) {
        console.log(chalk.yellow(`Configuration key '${key}' not found`));
        return;
      }

      console.log(chalk.white(`${key}: ${value}`));

    } catch (error) {
      throw new CLIError(`Failed to get config: ${error}`);
    }
  }

  async reset(options: any = {}) {
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to reset all configuration to defaults?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('Reset cancelled.'));
        return;
      }
    }

    const spinner = ora('Resetting configuration...').start();

    try {
      const defaultConfig = this.getDefaultConfig();
      await this.saveConfig(defaultConfig);

      spinner.succeed('Configuration reset to defaults');

    } catch (error) {
      spinner.fail('Failed to reset configuration');
      throw new CLIError(`Failed to reset config: ${error}`);
    }
  }

  async interactive() {
    console.log(chalk.blue('⚙️ Interactive Configuration Setup\n'));

    try {
      const currentConfig = await this.getConfig();

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'apiUrl',
          message: 'API URL (leave empty for default):',
          default: currentConfig.apiUrl || '',
        },
        {
          type: 'confirm',
          name: 'defaultIncludeSources',
          message: 'Include sources in query responses by default?',
          default: currentConfig.defaultIncludeSources !== false,
        },
        {
          type: 'number',
          name: 'defaultVoiceDuration',
          message: 'Default voice recording duration (seconds):',
          default: currentConfig.defaultVoiceDuration || 30,
          validate: (input) => {
            if (input < 5 || input > 120) {
              return 'Duration must be between 5 and 120 seconds';
            }
            return true;
          },
        },
        {
          type: 'confirm',
          name: 'verboseOutput',
          message: 'Enable verbose output by default?',
          default: currentConfig.verboseOutput || false,
        },
        {
          type: 'confirm',
          name: 'colorOutput',
          message: 'Enable colored output?',
          default: currentConfig.colorOutput !== false,
        },
      ]);

      const spinner = ora('Saving configuration...').start();

      // Clean up empty values
      const newConfig: CLIConfig = {};
      Object.entries(answers).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          (newConfig as any)[key] = value;
        }
      });

      await this.saveConfig(newConfig);

      spinner.succeed('Configuration saved successfully!');

    } catch (error) {
      throw new CLIError(`Interactive config failed: ${error}`);
    }
  }

  private async getConfig(): Promise<CLIConfig> {
    try {
      const settings = await this.storageService.getSettings();
      return settings?.cli || this.getDefaultConfig();
    } catch {
      return this.getDefaultConfig();
    }
  }

  private async saveConfig(config: CLIConfig): Promise<void> {
    try {
      let settings = await this.storageService.getSettings() || {};
      settings.cli = config;
      await this.storageService.storeSettings(settings);
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  private getDefaultConfig(): CLIConfig {
    return {
      defaultIncludeSources: true,
      defaultVoiceDuration: 30,
      verboseOutput: false,
      colorOutput: true,
    };
  }

  private parseConfigValue(key: string, value: string): any {
    switch (key) {
      case 'defaultIncludeSources':
      case 'verboseOutput':
      case 'colorOutput':
        if (value.toLowerCase() === 'true' || value === '1') return true;
        if (value.toLowerCase() === 'false' || value === '0') return false;
        throw new Error(`Boolean value expected for ${key}`);

      case 'defaultVoiceDuration':
        const num = parseInt(value);
        if (isNaN(num) || num < 5 || num > 120) {
          throw new Error(`Duration must be between 5 and 120 seconds`);
        }
        return num;

      case 'apiUrl':
        if (value && !value.startsWith('https://')) {
          throw new Error('API URL must start with https://');
        }
        return value || undefined;

      default:
        throw new Error(`Unknown configuration key: ${key}`);
    }
  }
}
