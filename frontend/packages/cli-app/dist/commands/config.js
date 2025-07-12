"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigCommand = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const shared_1 = require("@manuel/shared");
const error_1 = require("../utils/error");
class ConfigCommand {
    constructor() {
        this.storageService = (0, shared_1.getStorageService)();
    }
    static register(program) {
        const config = new ConfigCommand();
        program
            .command('show')
            .description('Show current configuration')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
            await (0, error_1.handleError)(() => config.show(options));
        });
        program
            .command('set <key> <value>')
            .description('Set a configuration value')
            .action(async (key, value) => {
            await (0, error_1.handleError)(() => config.set(key, value));
        });
        program
            .command('get <key>')
            .description('Get a configuration value')
            .action(async (key) => {
            await (0, error_1.handleError)(() => config.get(key));
        });
        program
            .command('reset')
            .description('Reset configuration to defaults')
            .option('-f, --force', 'Skip confirmation prompt')
            .action(async (options) => {
            await (0, error_1.handleError)(() => config.reset(options));
        });
        program
            .command('interactive')
            .description('Interactive configuration setup')
            .action(async () => {
            await (0, error_1.handleError)(() => config.interactive());
        });
    }
    async show(options = {}) {
        const spinner = (0, ora_1.default)('Loading configuration...').start();
        try {
            const config = await this.getConfig();
            spinner.succeed('Configuration loaded');
            if (options.json) {
                console.log(JSON.stringify(config, null, 2));
                return;
            }
            console.log(chalk_1.default.bold('\n⚙️ Current Configuration:'));
            console.log(chalk_1.default.white(`API URL: ${config.apiUrl || 'default'}`));
            console.log(chalk_1.default.white(`Include sources by default: ${config.defaultIncludeSources ? 'yes' : 'no'}`));
            console.log(chalk_1.default.white(`Default voice duration: ${config.defaultVoiceDuration || 30}s`));
            console.log(chalk_1.default.white(`Verbose output: ${config.verboseOutput ? 'yes' : 'no'}`));
            console.log(chalk_1.default.white(`Color output: ${config.colorOutput !== false ? 'yes' : 'no'}`));
        }
        catch (error) {
            spinner.fail('Failed to load configuration');
            throw new error_1.CLIError(`Failed to load config: ${error}`);
        }
    }
    async set(key, value) {
        const spinner = (0, ora_1.default)('Updating configuration...').start();
        try {
            const config = await this.getConfig();
            // Validate and convert value
            const parsedValue = this.parseConfigValue(key, value);
            // Update config
            config[key] = parsedValue;
            // Save config
            await this.saveConfig(config);
            spinner.succeed(`Configuration updated: ${key} = ${parsedValue}`);
        }
        catch (error) {
            spinner.fail('Failed to update configuration');
            throw new error_1.CLIError(`Failed to set config: ${error}`);
        }
    }
    async get(key) {
        try {
            const config = await this.getConfig();
            const value = config[key];
            if (value === undefined) {
                console.log(chalk_1.default.yellow(`Configuration key '${key}' not found`));
                return;
            }
            console.log(chalk_1.default.white(`${key}: ${value}`));
        }
        catch (error) {
            throw new error_1.CLIError(`Failed to get config: ${error}`);
        }
    }
    async reset(options = {}) {
        if (!options.force) {
            const { confirm } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you want to reset all configuration to defaults?',
                    default: false,
                },
            ]);
            if (!confirm) {
                console.log(chalk_1.default.yellow('Reset cancelled.'));
                return;
            }
        }
        const spinner = (0, ora_1.default)('Resetting configuration...').start();
        try {
            const defaultConfig = this.getDefaultConfig();
            await this.saveConfig(defaultConfig);
            spinner.succeed('Configuration reset to defaults');
        }
        catch (error) {
            spinner.fail('Failed to reset configuration');
            throw new error_1.CLIError(`Failed to reset config: ${error}`);
        }
    }
    async interactive() {
        console.log(chalk_1.default.blue('⚙️ Interactive Configuration Setup\n'));
        try {
            const currentConfig = await this.getConfig();
            const answers = await inquirer_1.default.prompt([
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
            const spinner = (0, ora_1.default)('Saving configuration...').start();
            // Clean up empty values
            const newConfig = {};
            Object.entries(answers).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    newConfig[key] = value;
                }
            });
            await this.saveConfig(newConfig);
            spinner.succeed('Configuration saved successfully!');
        }
        catch (error) {
            throw new error_1.CLIError(`Interactive config failed: ${error}`);
        }
    }
    async getConfig() {
        try {
            const settings = await this.storageService.getSettings();
            return settings?.cli || this.getDefaultConfig();
        }
        catch {
            return this.getDefaultConfig();
        }
    }
    async saveConfig(config) {
        try {
            let settings = await this.storageService.getSettings() || {};
            settings.cli = config;
            await this.storageService.storeSettings(settings);
        }
        catch (error) {
            throw new Error(`Failed to save configuration: ${error}`);
        }
    }
    getDefaultConfig() {
        return {
            defaultIncludeSources: true,
            defaultVoiceDuration: 30,
            verboseOutput: false,
            colorOutput: true,
        };
    }
    parseConfigValue(key, value) {
        switch (key) {
            case 'defaultIncludeSources':
            case 'verboseOutput':
            case 'colorOutput':
                if (value.toLowerCase() === 'true' || value === '1')
                    return true;
                if (value.toLowerCase() === 'false' || value === '0')
                    return false;
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
exports.ConfigCommand = ConfigCommand;
//# sourceMappingURL=config.js.map