#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { checkForUpdates } from '../utils/updater';
import { AuthCommand } from '../commands/auth';
import { QueryCommand } from '../commands/query';
import { ManualsCommand } from '../commands/manuals';
import { UsageCommand } from '../commands/usage';
import { ConfigCommand } from '../commands/config';
import { BootstrapCommand } from '../commands/bootstrap';
import { IngestionCommand } from '../commands/ingestion';

const program = new Command();

// ASCII Art Banner
function showBanner() {
  console.log(
    chalk.blue(
      figlet.textSync('Manuel', {
        font: 'Speed',
        horizontalLayout: 'default',
        verticalLayout: 'default',
      })
    )
  );
  console.log(chalk.gray('Voice Assistant for Product Manuals\n'));
}

// Main CLI setup
async function main() {
  try {
    // Check for updates in the background
    checkForUpdates();

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
          chalk.level = 0;
        }
        process.env.VERBOSE = opts.verbose ? 'true' : 'false';
      });

    // Authentication commands
    const authCmd = program
      .command('auth')
      .description('Authentication management');

    AuthCommand.register(authCmd);

    // Query commands
    const queryCmd = program
      .command('query')
      .alias('q')
      .description('Query your manuals');

    QueryCommand.register(queryCmd);

    // Manual management commands
    const manualsCmd = program
      .command('manuals')
      .alias('m')
      .description('Manage your manuals');

    ManualsCommand.register(manualsCmd);

    // Usage and analytics commands
    const usageCmd = program
      .command('usage')
      .alias('u')
      .description('View usage statistics');

    UsageCommand.register(usageCmd);

    // Configuration commands
    const configCmd = program
      .command('config')
      .alias('c')
      .description('Manage configuration');

    ConfigCommand.register(configCmd);

    // Bootstrap commands
    const bootstrapCmd = program
      .command('bootstrap')
      .description('Bootstrap system with sample data');

    BootstrapCommand.register(bootstrapCmd);

    // Ingestion monitoring commands
    IngestionCommand.register(program);

    // Quick commands (shortcuts)
    program
      .command('ask <question>')
      .description('Quick query (shortcut for query ask)')
      .option('-v, --voice', 'Use voice input instead of text')
      .option('-s, --sources', 'Include sources in response')
      .action(async (question, options) => {
        const queryCommand = new QueryCommand();
        if (options.voice) {
          await queryCommand.voice();
        } else {
          await queryCommand.ask(question, options);
        }
      });

    program
      .command('upload <file>')
      .description('Quick manual upload (shortcut for manuals upload)')
      .action(async (file) => {
        const manualsCommand = new ManualsCommand();
        await manualsCommand.upload(file);
      });

    program
      .command('download <url>')
      .description('Quick manual download (shortcut for manuals download)')
      .option('-n, --name <name>', 'Custom filename')
      .action(async (url, options) => {
        const manualsCommand = new ManualsCommand();
        await manualsCommand.download(url, options);
      });

    // Interactive mode
    program
      .command('interactive')
      .alias('i')
      .description('Start interactive mode')
      .action(async () => {
        const { InteractiveMode } = await import('../utils/interactive');
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
  $ manuel bootstrap populate           Process existing manuals
  $ manuel ingestion status             Check ingestion jobs
  $ manuel interactive                   Start interactive mode

For more help on a specific command:
  $ manuel <command> --help
    `);

    // Error handling
    program.exitOverride();

    try {
      await program.parseAsync(process.argv);
    } catch (err: any) {
      if (err.code === 'commander.unknownCommand') {
        console.error(chalk.red(`Unknown command: ${err.message}`));
        console.log(chalk.yellow('Use "manuel --help" to see available commands.'));
        process.exit(1);
      } else if (err.code === 'commander.helpDisplayed') {
        process.exit(0);
      } else {
        console.error(chalk.red('Error:'), err.message);
        process.exit(1);
      }
    }

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Unhandled error:'), error);
    process.exit(1);
  });
}

export { program };
