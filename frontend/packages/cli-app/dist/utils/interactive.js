"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveMode = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const auth_1 = require("../commands/auth");
const query_1 = require("../commands/query");
const manuals_1 = require("../commands/manuals");
const usage_1 = require("../commands/usage");
const config_1 = require("../commands/config");
const shared_1 = require("@manuel/shared");
const error_1 = require("./error");
class InteractiveMode {
    constructor() {
        this.storageService = (0, shared_1.getStorageService)();
        this.authCommand = new auth_1.AuthCommand();
        this.queryCommand = new query_1.QueryCommand();
        this.manualsCommand = new manuals_1.ManualsCommand();
        this.usageCommand = new usage_1.UsageCommand();
        this.configCommand = new config_1.ConfigCommand();
    }
    async start() {
        console.clear();
        // Display welcome banner
        await this.showWelcome();
        // Check authentication status
        const isAuthenticated = await this.checkAuth();
        if (!isAuthenticated) {
            console.log(chalk_1.default.yellow('\n🔐 You need to be authenticated to use Manuel.'));
            const shouldLogin = await this.promptLogin();
            if (!shouldLogin) {
                console.log(chalk_1.default.gray('Goodbye!'));
                return;
            }
            await this.handleLogin();
        }
        // Main interactive loop
        await this.mainLoop();
    }
    async showWelcome() {
        try {
            const banner = figlet_1.default.textSync('Manuel', {
                font: 'Small',
                horizontalLayout: 'default',
                verticalLayout: 'default',
            });
            console.log(chalk_1.default.blue(banner));
            console.log(chalk_1.default.gray('Voice assistant for product manuals\n'));
        }
        catch {
            // Fallback if figlet fails
            console.log(chalk_1.default.blue.bold('Manuel CLI'));
            console.log(chalk_1.default.gray('Voice assistant for product manuals\n'));
        }
    }
    async checkAuth() {
        try {
            const tokens = await this.storageService.getAuthTokens();
            return !!tokens;
        }
        catch {
            return false;
        }
    }
    async promptLogin() {
        const { shouldLogin } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'shouldLogin',
                message: 'Would you like to log in now?',
                default: true,
            },
        ]);
        return shouldLogin;
    }
    async handleLogin() {
        const { action } = await inquirer_1.default.prompt([
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
                    await this.authCommand.forgotPassword();
                    break;
            }
            console.log(chalk_1.default.green('\n✅ Authentication successful!'));
        }
        catch (error) {
            console.log(chalk_1.default.red('\n❌ Authentication failed.'));
            throw error;
        }
    }
    async mainLoop() {
        while (true) {
            try {
                const { action } = await inquirer_1.default.prompt([
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
                            new inquirer_1.default.Separator(),
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
                        console.log(chalk_1.default.gray('\nGoodbye!'));
                        return;
                }
                // Add spacing between actions
                console.log();
            }
            catch (error) {
                if (error instanceof error_1.CLIError) {
                    console.log(chalk_1.default.red(`\n❌ ${error.message}`));
                }
                else {
                    console.log(chalk_1.default.red('\n❌ An unexpected error occurred.'));
                }
                // Ask if user wants to continue
                const { shouldContinue } = await inquirer_1.default.prompt([
                    {
                        type: 'confirm',
                        name: 'shouldContinue',
                        message: 'Would you like to continue?',
                        default: true,
                    },
                ]);
                if (!shouldContinue) {
                    console.log(chalk_1.default.gray('Goodbye!'));
                    return;
                }
            }
        }
    }
    async handleTextQuery() {
        const { question } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'question',
                message: 'What would you like to know?',
                validate: (input) => input.trim().length > 0 || 'Please enter a question',
            },
        ]);
        const { includeSources } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'includeSources',
                message: 'Include source references in the response?',
                default: true,
            },
        ]);
        await (0, error_1.handleError)(() => this.queryCommand.ask(question, { sources: includeSources }));
    }
    async handleVoiceQuery() {
        console.log(chalk_1.default.blue('\n🎤 Voice Query'));
        console.log(chalk_1.default.gray('Press Enter to start recording, press Enter again to stop.'));
        await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'start',
                message: 'Press Enter to start recording...',
            },
        ]);
        await (0, error_1.handleError)(() => this.queryCommand.voice({}));
    }
    async handleManuals() {
        const { action } = await inquirer_1.default.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'Manual management:',
                choices: [
                    { name: 'List all manuals', value: 'list' },
                    { name: 'Upload from device', value: 'upload' },
                    { name: '🌐 Upload from URL', value: 'download' },
                    { name: 'Delete manual', value: 'delete' },
                    { name: 'Interactive management', value: 'interactive' },
                    { name: 'Back to main menu', value: 'back' },
                ],
            },
        ]);
        if (action === 'back')
            return;
        switch (action) {
            case 'list':
                await (0, error_1.handleError)(() => this.manualsCommand.list());
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
                await (0, error_1.handleError)(() => this.manualsCommand.interactive());
                break;
        }
    }
    async handleManualUpload() {
        const { filePath } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'filePath',
                message: 'Enter the path to the manual file:',
                validate: (input) => input.trim().length > 0 || 'Please enter a file path',
            },
        ]);
        await (0, error_1.handleError)(() => this.manualsCommand.upload(filePath, {}));
    }
    async handleManualDownload() {
        const { url } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'url',
                message: 'Enter the URL of the manual:',
                validate: (input) => {
                    try {
                        new URL(input);
                        return true;
                    }
                    catch {
                        return 'Please enter a valid URL';
                    }
                },
            },
        ]);
        const { name } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Enter a name for the manual (optional):',
            },
        ]);
        const options = name ? { name } : {};
        await (0, error_1.handleError)(() => this.manualsCommand.download(url, options));
    }
    async handleManualDelete() {
        const { manualId } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'manualId',
                message: 'Enter the manual ID to delete:',
                validate: (input) => input.trim().length > 0 || 'Please enter a manual ID',
            },
        ]);
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure you want to delete manual "${manualId}"?`,
                default: false,
            },
        ]);
        if (confirm) {
            await (0, error_1.handleError)(() => this.manualsCommand.delete(manualId, { force: true }));
        }
        else {
            console.log(chalk_1.default.yellow('Delete cancelled.'));
        }
    }
    async handleUsage() {
        const { action } = await inquirer_1.default.prompt([
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
        if (action === 'back')
            return;
        switch (action) {
            case 'overview':
                await (0, error_1.handleError)(() => this.usageCommand.overview());
                break;
            case 'today':
                await (0, error_1.handleError)(() => this.usageCommand.today());
                break;
            case 'quotas':
                await (0, error_1.handleError)(() => this.usageCommand.quotas());
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
    async handleCosts() {
        const { period } = await inquirer_1.default.prompt([
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
        await (0, error_1.handleError)(() => this.usageCommand.costs({ period }));
    }
    async handleHistory() {
        const { days } = await inquirer_1.default.prompt([
            {
                type: 'number',
                name: 'days',
                message: 'Number of days to show:',
                default: 7,
                validate: (input) => (input > 0 && input <= 365) || 'Must be between 1 and 365 days',
            },
        ]);
        await (0, error_1.handleError)(() => this.usageCommand.history({ days: days.toString() }));
    }
    async handleExport() {
        const answers = await inquirer_1.default.prompt([
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
        const options = { days: answers.days.toString(), format: answers.format };
        if (answers.output) {
            options.output = answers.output;
        }
        await (0, error_1.handleError)(() => this.usageCommand.export(options));
    }
    async handleConfig() {
        const { action } = await inquirer_1.default.prompt([
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
        if (action === 'back')
            return;
        switch (action) {
            case 'show':
                await (0, error_1.handleError)(() => this.configCommand.show());
                break;
            case 'interactive':
                await (0, error_1.handleError)(() => this.configCommand.interactive());
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
    async handleConfigSet() {
        const answers = await inquirer_1.default.prompt([
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
        await (0, error_1.handleError)(() => this.configCommand.set(answers.key, answers.value));
    }
    async handleConfigGet() {
        const { key } = await inquirer_1.default.prompt([
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
        await (0, error_1.handleError)(() => this.configCommand.get(key));
    }
    async handleConfigReset() {
        const { confirm } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Are you sure you want to reset all settings to defaults?',
                default: false,
            },
        ]);
        if (confirm) {
            await (0, error_1.handleError)(() => this.configCommand.reset({ force: true }));
        }
        else {
            console.log(chalk_1.default.yellow('Reset cancelled.'));
        }
    }
    async handleAuth() {
        const { action } = await inquirer_1.default.prompt([
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
        if (action === 'back')
            return;
        switch (action) {
            case 'status':
                await (0, error_1.handleError)(() => this.authCommand.status());
                break;
            case 'login':
                await (0, error_1.handleError)(() => this.authCommand.login());
                break;
            case 'signup':
                await (0, error_1.handleError)(() => this.authCommand.signup());
                break;
            case 'logout':
                await (0, error_1.handleError)(() => this.authCommand.logout());
                break;
            case 'reset':
                await (0, error_1.handleError)(() => this.authCommand.forgotPassword());
                break;
        }
    }
}
exports.InteractiveMode = InteractiveMode;
//# sourceMappingURL=interactive.js.map