"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryCommand = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const shared_1 = require("@manuel/shared");
const shared_2 = require("@manuel/shared");
const error_1 = require("../utils/error");
const formatting_1 = require("../utils/formatting");
const auth_1 = require("../utils/auth");
class QueryCommand {
    constructor() {
        this.audioService = (0, shared_2.getAudioService)();
    }
    static register(program) {
        const query = new QueryCommand();
        program
            .command('ask <question>')
            .description('Ask a question about your manuals')
            .option('-s, --sources', 'Include sources in response')
            .option('-v, --verbose', 'Show detailed response information')
            .action(async (question, options) => {
            await (0, error_1.handleError)(() => query.ask(question, options));
        });
        program
            .command('voice')
            .description('Ask a question using voice input')
            .option('-s, --sources', 'Include sources in response')
            .option('-d, --duration <seconds>', 'Maximum recording duration', '30')
            .action(async (options) => {
            await (0, error_1.handleError)(() => query.voice(options));
        });
        program
            .command('history')
            .description('View query history')
            .option('-l, --limit <number>', 'Number of queries to show', '10')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
            await (0, error_1.handleError)(() => query.history(options));
        });
        program
            .command('interactive')
            .alias('chat')
            .description('Start interactive query session')
            .option('-s, --sources', 'Include sources in responses')
            .action(async (options) => {
            await (0, error_1.handleError)(() => query.interactive(options));
        });
    }
    async ask(question, options = {}) {
        await (0, auth_1.requireAuth)();
        if (!question || question.trim().length === 0) {
            throw new error_1.CLIError('Question cannot be empty');
        }
        console.log(chalk_1.default.blue('🤔 Thinking...\n'));
        const spinner = (0, ora_1.default)('Processing your question...').start();
        try {
            // Add progress indication for long-running requests
            const timeout = setTimeout(() => {
                spinner.text = 'Still processing... (this may take up to 30 seconds)';
            }, 5000);
            const response = await shared_1.queryService.textQuery(question, options.sources !== false);
            clearTimeout(timeout);
            spinner.succeed(chalk_1.default.green('Got an answer!'));
            // Display the response
            console.log(chalk_1.default.bold('\n📝 Answer:'));
            console.log(chalk_1.default.white(response.response));
            // Show sources if available and requested
            if (options.sources && response.sources && response.sources.length > 0) {
                console.log(chalk_1.default.bold('\n📚 Sources:'));
                response.sources.forEach((source, index) => {
                    console.log(chalk_1.default.gray(`${index + 1}. ${source.metadata.source} (score: ${source.metadata.score.toFixed(2)})`));
                    if (options.verbose) {
                        console.log(chalk_1.default.gray(`   "${source.content.substring(0, 100)}..."`));
                    }
                });
            }
            // Show usage info if available
            if (response.usage && options.verbose) {
                console.log(chalk_1.default.bold('\n📊 Usage:'));
                console.log(chalk_1.default.gray(`Daily queries: ${response.usage.daily_queries}/${response.usage.daily_limit}`));
                console.log(chalk_1.default.gray(`Monthly queries: ${response.usage.monthly_queries}/${response.usage.monthly_limit}`));
            }
            // Show cost info if available
            if (response.costs && options.verbose) {
                console.log(chalk_1.default.bold('\n💰 Cost:'));
                console.log(chalk_1.default.gray(`Total: $${response.costs.total_cost.toFixed(4)}`));
                console.log(chalk_1.default.gray(`Processing time: ${response.processing_time_ms}ms`));
            }
        }
        catch (error) {
            spinner.fail('Query failed');
            // Check if it's a timeout error
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ECONNABORTED') {
                throw new error_1.CLIError('Request timed out. The API may be experiencing delays. Please try again.');
            }
            throw new error_1.CLIError(`Failed to process question: ${error}`);
        }
    }
    async voice(options = {}) {
        await (0, auth_1.requireAuth)();
        console.log(chalk_1.default.blue('🎤 Voice Query\n'));
        // Check audio permissions
        const hasPermission = await this.audioService.requestPermissions();
        if (!hasPermission) {
            throw new error_1.CLIError('Audio recording permission required for voice queries');
        }
        const maxDuration = parseInt(options.duration) || 30;
        console.log(chalk_1.default.yellow(`Press ENTER to start recording (max ${maxDuration}s)...`));
        await this.waitForEnter();
        const spinner = (0, ora_1.default)('Recording... (Press Ctrl+C to stop)').start();
        try {
            // Set up recording stop handler
            let recordingStopped = false;
            const stopRecording = async () => {
                if (!recordingStopped) {
                    recordingStopped = true;
                    spinner.text = 'Stopping recording...';
                    const recording = await this.audioService.stopRecording();
                    spinner.succeed(`Recorded ${(0, formatting_1.formatDuration)(recording.duration)}`);
                    return recording;
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
            setTimeout(stopRecording, maxDuration * 1000);
            // Wait for recording to finish
            while (!recordingStopped) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            const recording = await stopRecording();
            if (!recording) {
                throw new error_1.CLIError('Failed to record audio');
            }
            // Convert to base64 and send query
            spinner.start('Transcribing and processing...');
            const audioBase64 = await this.audioService.convertToBase64(recording.uri);
            const audioFormat = this.audioService.getAudioFormat();
            const response = await shared_1.queryService.voiceQuery(audioBase64, `audio/${audioFormat}`, options.sources !== false);
            spinner.succeed(chalk_1.default.green('Voice query processed!'));
            // Display the response (same as text query)
            console.log(chalk_1.default.bold('\n📝 Answer:'));
            console.log(chalk_1.default.white(response.response));
            if (options.sources && response.sources && response.sources.length > 0) {
                console.log(chalk_1.default.bold('\n📚 Sources:'));
                response.sources.forEach((source, index) => {
                    console.log(chalk_1.default.gray(`${index + 1}. ${source.metadata.source} (score: ${source.metadata.score.toFixed(2)})`));
                });
            }
            // Cleanup
            await this.audioService.cleanup();
        }
        catch (error) {
            spinner.fail('Voice query failed');
            await this.audioService.cleanup();
            throw new error_1.CLIError(`Voice query failed: ${error}`);
        }
    }
    async history(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading query history...').start();
        try {
            // This would need to be implemented in the backend
            // For now, show a placeholder
            spinner.info('Query history feature coming soon!');
            console.log(chalk_1.default.gray('Future feature: View your recent queries and responses'));
        }
        catch (error) {
            spinner.fail('Failed to load history');
            throw new error_1.CLIError(`Failed to load query history: ${error}`);
        }
    }
    async interactive(options = {}) {
        await (0, auth_1.requireAuth)();
        console.log(chalk_1.default.blue('💬 Interactive Query Mode\n'));
        console.log(chalk_1.default.gray('Ask questions about your manuals. Type "exit" to quit.\n'));
        while (true) {
            try {
                const { question } = await inquirer_1.default.prompt([
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
                    console.log(chalk_1.default.green('\nGoodbye! 👋'));
                    break;
                }
                await this.ask(question, options);
                console.log(chalk_1.default.gray('\n' + '─'.repeat(50) + '\n'));
            }
            catch (error) {
                console.error(chalk_1.default.red(`Error: ${error}`));
                console.log(chalk_1.default.gray('\n' + '─'.repeat(50) + '\n'));
            }
        }
    }
    async waitForEnter() {
        return new Promise((resolve) => {
            process.stdin.once('data', () => {
                resolve();
            });
        });
    }
}
exports.QueryCommand = QueryCommand;
//# sourceMappingURL=query.js.map
