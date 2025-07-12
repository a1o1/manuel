#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.program = void 0;
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const figlet_1 = __importDefault(require("figlet"));
const updater_1 = require("../utils/updater");
const auth_1 = require("../commands/auth");
const query_1 = require("../commands/query");
const manuals_1 = require("../commands/manuals");
const usage_1 = require("../commands/usage");
const config_1 = require("../commands/config");
const program = new commander_1.Command();
exports.program = program;
// ASCII Art Banner
function showBanner() {
    console.log(chalk_1.default.blue(figlet_1.default.textSync('Manuel', {
        font: 'Speed',
        horizontalLayout: 'default',
        verticalLayout: 'default',
    })));
    console.log(chalk_1.default.gray('Voice Assistant for Product Manuals\n'));
}
// Main CLI setup
async function main() {
    try {
        // Check for updates in the background
        (0, updater_1.checkForUpdates)();
        // Show banner for interactive use
        if (process.argv.length === 2) {
            showBanner();
        }
        // Configure main program
        program
            .name('manuel')
            .description('Voice Assistant for Product Manuals')
            .version('1.0.0')
            .option('-v, --verbose', 'Enable verbose output')
            .option('--no-color', 'Disable colored output')
            .hook('preAction', (thisCommand) => {
            // Set global options
            const opts = thisCommand.opts();
            if (opts.noColor) {
                chalk_1.default.level = 0;
            }
            process.env.VERBOSE = opts.verbose ? 'true' : 'false';
        });
        // Authentication commands
        const authCmd = program
            .command('auth')
            .description('Authentication management');
        auth_1.AuthCommand.register(authCmd);
        // Query commands
        const queryCmd = program
            .command('query')
            .alias('q')
            .description('Query your manuals');
        query_1.QueryCommand.register(queryCmd);
        // Manual management commands
        const manualsCmd = program
            .command('manuals')
            .alias('m')
            .description('Manage your manuals');
        manuals_1.ManualsCommand.register(manualsCmd);
        // Usage and analytics commands
        const usageCmd = program
            .command('usage')
            .alias('u')
            .description('View usage statistics');
        usage_1.UsageCommand.register(usageCmd);
        // Configuration commands
        const configCmd = program
            .command('config')
            .alias('c')
            .description('Manage configuration');
        config_1.ConfigCommand.register(configCmd);
        // Quick commands (shortcuts)
        program
            .command('ask <question>')
            .description('Quick query (shortcut for query ask)')
            .option('-v, --voice', 'Use voice input instead of text')
            .option('-s, --sources', 'Include sources in response')
            .action(async (question, options) => {
            const queryCommand = new query_1.QueryCommand();
            if (options.voice) {
                await queryCommand.voice();
            }
            else {
                await queryCommand.ask(question, options);
            }
        });
        program
            .command('upload <file>')
            .description('Quick manual upload (shortcut for manuals upload)')
            .action(async (file) => {
            const manualsCommand = new manuals_1.ManualsCommand();
            await manualsCommand.upload(file);
        });
        program
            .command('download <url>')
            .description('Quick manual download (shortcut for manuals download)')
            .option('-n, --name <name>', 'Custom filename')
            .action(async (url, options) => {
            const manualsCommand = new manuals_1.ManualsCommand();
            await manualsCommand.download(url, options);
        });
        // Interactive mode
        program
            .command('interactive')
            .alias('i')
            .description('Start interactive mode')
            .action(async () => {
            const { InteractiveMode } = await Promise.resolve().then(() => __importStar(require('../utils/interactive')));
            const interactive = new InteractiveMode();
            await interactive.start();
        });
        // Help customization
        program.configureHelp({
            sortSubcommands: true,
            showGlobalOptions: true,
        });
        // Add examples to help
        program.addHelpText('after', `
Examples:
  $ manuel auth login                    Login to your account
  $ manuel ask "How do I reset my device?"  Quick question
  $ manuel query voice                   Ask using voice input
  $ manuel upload manual.pdf             Upload a manual
  $ manuel download https://...          Download from URL
  $ manuel manuals list                  List all manuals
  $ manuel usage today                   View today's usage
  $ manuel interactive                   Start interactive mode

For more help on a specific command:
  $ manuel <command> --help
    `);
        // Error handling
        program.exitOverride();
        try {
            await program.parseAsync(process.argv);
        }
        catch (err) {
            if (err.code === 'commander.unknownCommand') {
                console.error(chalk_1.default.red(`Unknown command: ${err.message}`));
                console.log(chalk_1.default.yellow('Use "manuel --help" to see available commands.'));
                process.exit(1);
            }
            else if (err.code === 'commander.helpDisplayed') {
                process.exit(0);
            }
            else {
                console.error(chalk_1.default.red('Error:'), err.message);
                process.exit(1);
            }
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Fatal error:'), error);
        process.exit(1);
    }
}
// Run the CLI
if (require.main === module) {
    main().catch((error) => {
        console.error(chalk_1.default.red('Unhandled error:'), error);
        process.exit(1);
    });
}
//# sourceMappingURL=manuel.js.map