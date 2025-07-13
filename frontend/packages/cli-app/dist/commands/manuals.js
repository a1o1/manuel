"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualsCommand = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const table_1 = require("table");
const shared_1 = require("@manuel/shared");
const shared_2 = require("@manuel/shared");
const error_1 = require("../utils/error");
const formatting_1 = require("../utils/formatting");
const auth_1 = require("../utils/auth");
const validation_1 = require("../utils/validation");
class ManualsCommand {
    constructor() {
        this.fileService = (0, shared_2.getFileService)();
    }
    static register(program) {
        const manuals = new ManualsCommand();
        program
            .command('list')
            .alias('ls')
            .description('List all your manuals')
            .option('--json', 'Output as JSON')
            .option('-v, --verbose', 'Show detailed information')
            .action(async (options) => {
            await (0, error_1.handleError)(() => manuals.list(options));
        });
        program
            .command('upload <file>')
            .description('Upload a manual file')
            .option('-n, --name <name>', 'Custom name for the manual')
            .action(async (file, options) => {
            await (0, error_1.handleError)(() => manuals.upload(file, options));
        });
        program
            .command('download <url>')
            .alias('url')
            .description('Download a manual from URL')
            .option('-n, --name <name>', 'Custom filename')
            .action(async (url, options) => {
            await (0, error_1.handleError)(() => manuals.download(url, options));
        });
        program
            .command('delete <key>')
            .alias('rm')
            .description('Delete a manual')
            .option('-f, --force', 'Skip confirmation prompt')
            .action(async (key, options) => {
            await (0, error_1.handleError)(() => manuals.delete(key, options));
        });
        program
            .command('info <key>')
            .description('Show detailed information about a manual')
            .action(async (key) => {
            await (0, error_1.handleError)(() => manuals.info(key));
        });
        program
            .command('search <term>')
            .description('Search for manuals by name')
            .action(async (term) => {
            await (0, error_1.handleError)(() => manuals.search(term));
        });
        program
            .command('interactive')
            .description('Interactive manual management')
            .action(async () => {
            await (0, error_1.handleError)(() => manuals.interactive());
        });
    }
    async list(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading manuals...').start();
        try {
            // Add progress indication for long-running requests
            const timeout = setTimeout(() => {
                spinner.text = 'Still loading... (this may take up to 30 seconds)';
            }, 5000);
            const { manuals, count } = await shared_1.manualService.getManuals();
            clearTimeout(timeout);
            spinner.succeed(`Found ${count} manual${count !== 1 ? 's' : ''}`);
            if (count === 0) {
                console.log(chalk_1.default.yellow('\nNo manuals found.'));
                console.log(chalk_1.default.gray('Use "manuel upload <file>" or "manuel download <url>" to add manuals.'));
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
                    chalk_1.default.white(manual.name),
                    chalk_1.default.gray((0, formatting_1.formatFileSize)(manual.size)),
                    chalk_1.default.gray((0, formatting_1.formatRelativeTime)(manual.upload_date)),
                    options.verbose ? chalk_1.default.gray(manual.id) : chalk_1.default.gray(manual.id.substring(0, 20) + '...')
                ]);
            });
            console.log('\n' + (0, table_1.table)(tableData, {
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
        }
        catch (error) {
            spinner.fail('Failed to load manuals');
            // Check if it's a timeout error
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
                throw new error_1.CLIError('Request timed out. The API may be experiencing delays. Please try again.');
            }
            throw new error_1.CLIError(`Failed to load manuals: ${error}`);
        }
    }
    async upload(filePath, options = {}) {
        await (0, auth_1.requireAuth)();
        console.log(chalk_1.default.blue('📄 Upload Manual\n'));
        // Validate file exists
        const fileExists = await this.fileService.fileExists(filePath);
        if (!fileExists) {
            throw new error_1.CLIError(`File not found: ${filePath}`);
        }
        const spinner = (0, ora_1.default)('Preparing file...').start();
        try {
            // Get file info
            const fileInfo = await this.fileService.getFileInfo(filePath);
            if (!fileInfo) {
                throw new error_1.CLIError('Unable to read file information');
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
                throw new error_1.CLIError(`Invalid file: ${validation.errors.join(', ')}`);
            }
            spinner.text = 'Reading file...';
            // Convert to base64
            const base64Content = await this.fileService.convertFileToBase64(fileSelection);
            spinner.text = 'Uploading...';
            // Upload to backend
            const result = await shared_1.manualService.uploadManual({
                file_name: fileSelection.name,
                file_data: base64Content,
                content_type: fileSelection.type,
            });
            spinner.succeed(chalk_1.default.green('Manual uploaded successfully!'));
            console.log(chalk_1.default.gray(`Name: ${result.file_name}`));
            console.log(chalk_1.default.gray(`Key: ${result.key}`));
            console.log(chalk_1.default.gray(`Status: ${result.status}`));
            if (result.size_bytes) {
                console.log(chalk_1.default.gray(`Size: ${(0, formatting_1.formatFileSize)(result.size_bytes)}`));
            }
            console.log(chalk_1.default.yellow('\n📚 Manual is being processed and will be available for queries shortly.'));
        }
        catch (error) {
            spinner.fail('Upload failed');
            throw new error_1.CLIError(`Upload failed: ${error}`);
        }
    }
    async download(url, options = {}) {
        await (0, auth_1.requireAuth)();
        console.log(chalk_1.default.blue('🌐 Download Manual from URL\n'));
        // Validate URL
        if (!(0, validation_1.validateUrl)(url)) {
            throw new error_1.CLIError('Invalid URL. Please provide a valid HTTPS URL.');
        }
        const spinner = (0, ora_1.default)('Downloading from URL...').start();
        try {
            const result = await shared_1.manualService.downloadManual({
                url,
                filename: options.name,
            });
            spinner.succeed(chalk_1.default.green('Manual downloaded and uploaded successfully!'));
            console.log(chalk_1.default.gray(`Name: ${result.file_name}`));
            console.log(chalk_1.default.gray(`Key: ${result.key}`));
            console.log(chalk_1.default.gray(`Size: ${(0, formatting_1.formatFileSize)(result.size_bytes || 0)}`));
            console.log(chalk_1.default.gray(`Download time: ${result.download_time_ms}ms`));
            if (result.security_warnings && result.security_warnings.length > 0) {
                console.log(chalk_1.default.yellow('\n⚠️ Security warnings:'));
                result.security_warnings.forEach(warning => {
                    console.log(chalk_1.default.yellow(`  • ${warning}`));
                });
            }
            console.log(chalk_1.default.yellow('\n📚 Manual is being processed and will be available for queries shortly.'));
        }
        catch (error) {
            spinner.fail('Download failed');
            throw new error_1.CLIError(`Download failed: ${error}`);
        }
    }
    async delete(key, options = {}) {
        await (0, auth_1.requireAuth)();
        if (!options.force) {
            const { confirm } = await inquirer_1.default.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to delete this manual?`,
                    default: false,
                },
            ]);
            if (!confirm) {
                console.log(chalk_1.default.yellow('Deletion cancelled.'));
                return;
            }
        }
        const spinner = (0, ora_1.default)('Deleting manual...').start();
        try {
            await shared_1.manualService.deleteManual(key);
            spinner.succeed(chalk_1.default.green('Manual deleted successfully!'));
        }
        catch (error) {
            spinner.fail('Deletion failed');
            throw new error_1.CLIError(`Failed to delete manual: ${error}`);
        }
    }
    async info(key) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading manual information...').start();
        try {
            const manual = await shared_1.manualService.getManualMetadata(key);
            const status = await shared_1.manualService.getProcessingStatus(key);
            spinner.succeed('Manual information loaded');
            console.log(chalk_1.default.bold('\n📄 Manual Information:'));
            console.log(chalk_1.default.white(`Name: ${manual.name}`));
            console.log(chalk_1.default.gray(`ID: ${manual.id}`));
            console.log(chalk_1.default.gray(`Size: ${(0, formatting_1.formatFileSize)(manual.size)}`));
            console.log(chalk_1.default.gray(`Uploaded: ${(0, formatting_1.formatRelativeTime)(manual.upload_date)}`));
            console.log(chalk_1.default.bold('\n🔄 Processing Status:'));
            console.log(chalk_1.default.gray(`Status: ${status.status}`));
            if (status.job_id) {
                console.log(chalk_1.default.gray(`Job ID: ${status.job_id}`));
            }
            if (status.created_at) {
                console.log(chalk_1.default.gray(`Created: ${(0, formatting_1.formatRelativeTime)(status.created_at)}`));
            }
            if (status.updated_at) {
                console.log(chalk_1.default.gray(`Updated: ${(0, formatting_1.formatRelativeTime)(status.updated_at)}`));
            }
        }
        catch (error) {
            spinner.fail('Failed to load manual information');
            throw new error_1.CLIError(`Failed to get manual info: ${error}`);
        }
    }
    async search(term) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Searching manuals...').start();
        try {
            const { manuals } = await shared_1.manualService.getManuals();
            const filtered = manuals.filter(manual => manual.name.toLowerCase().includes(term.toLowerCase()));
            spinner.succeed(`Found ${filtered.length} matching manual${filtered.length !== 1 ? 's' : ''}`);
            if (filtered.length === 0) {
                console.log(chalk_1.default.yellow('\nNo manuals found matching your search.'));
                return;
            }
            // Display results
            filtered.forEach(manual => {
                console.log(chalk_1.default.white(`\n📄 ${manual.name}`));
                console.log(chalk_1.default.gray(`   Size: ${(0, formatting_1.formatFileSize)(manual.size)}`));
                console.log(chalk_1.default.gray(`   Uploaded: ${(0, formatting_1.formatRelativeTime)(manual.upload_date)}`));
                console.log(chalk_1.default.gray(`   ID: ${manual.id}`));
            });
        }
        catch (error) {
            spinner.fail('Search failed');
            throw new error_1.CLIError(`Search failed: ${error}`);
        }
    }
    async interactive() {
        await (0, auth_1.requireAuth)();
        console.log(chalk_1.default.blue('📚 Interactive Manual Management\n'));
        while (true) {
            try {
                const { action } = await inquirer_1.default.prompt([
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
                    console.log(chalk_1.default.green('\nGoodbye! 👋'));
                    break;
                }
                switch (action) {
                    case 'list':
                        await this.list();
                        break;
                    case 'upload':
                        const { filePath } = await inquirer_1.default.prompt([
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
                        const { url } = await inquirer_1.default.prompt([
                            {
                                type: 'input',
                                name: 'url',
                                message: 'URL:',
                                validate: (input) => (0, validation_1.validateUrl)(input) || 'Please enter a valid HTTPS URL',
                            },
                        ]);
                        await this.download(url);
                        break;
                    case 'search':
                        const { searchTerm } = await inquirer_1.default.prompt([
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
                        const { keyToDelete } = await inquirer_1.default.prompt([
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
                console.log(chalk_1.default.gray('\n' + '─'.repeat(50) + '\n'));
            }
            catch (error) {
                console.error(chalk_1.default.red(`Error: ${error}`));
                console.log(chalk_1.default.gray('\n' + '─'.repeat(50) + '\n'));
            }
        }
    }
}
exports.ManualsCommand = ManualsCommand;
//# sourceMappingURL=manuals.js.map
