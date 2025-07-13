import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { usageService, API_CONFIG } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';
import { formatCurrency, formatNumber, formatPercentage } from '../utils/formatting';
import { requireAuth } from '../utils/auth';

export class UsageCommand {
  static register(program: Command) {
    const usage = new UsageCommand();

    program
      .command('overview')
      .alias('stats')
      .description('Show usage overview')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await handleError(() => usage.overview(options));
      });

    program
      .command('today')
      .description('Show today\'s usage')
      .action(async () => {
        await handleError(() => usage.today());
      });

    program
      .command('quotas')
      .description('Show quota limits and remaining usage')
      .action(async () => {
        await handleError(() => usage.quotas());
      });

    program
      .command('costs')
      .description('Show cost breakdown')
      .option('-p, --period <period>', 'Time period (daily|weekly|monthly)', 'daily')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await handleError(() => usage.costs(options));
      });

    program
      .command('history')
      .description('Show usage history')
      .option('-d, --days <days>', 'Number of days to show', '7')
      .option('--json', 'Output as JSON')
      .action(async (options) => {
        await handleError(() => usage.history(options));
      });

    program
      .command('export')
      .description('Export usage data')
      .option('-d, --days <days>', 'Number of days to export', '30')
      .option('-f, --format <format>', 'Export format (csv|json)', 'csv')
      .option('-o, --output <file>', 'Output file path')
      .action(async (options) => {
        await handleError(() => usage.export(options));
      });
  }

  async overview(options: any = {}) {
    await requireAuth();

    const spinner = ora('Loading usage statistics...').start();

    try {
      const stats = await usageService.getUsageStats();

      spinner.succeed('Usage statistics loaded');

      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      // Current usage
      console.log(chalk.bold('\n📊 Current Usage:'));
      console.log(chalk.white(`Daily queries: ${stats.current_usage.daily_queries}/${stats.current_usage.daily_limit}`));
      console.log(chalk.gray(`  Remaining: ${stats.current_usage.daily_remaining}`));
      console.log(chalk.white(`Monthly queries: ${stats.current_usage.monthly_queries}/${stats.current_usage.monthly_limit}`));
      console.log(chalk.gray(`  Remaining: ${stats.current_usage.monthly_remaining}`));

      // Daily costs
      if (stats.daily_costs) {
        console.log(chalk.bold('\n💰 Today\'s Costs:'));
        console.log(chalk.white(`Total: ${formatCurrency(stats.daily_costs.total_cost)}`));
        if (stats.daily_costs.transcribe_cost > 0) {
          console.log(chalk.gray(`  Transcription: ${formatCurrency(stats.daily_costs.transcribe_cost)}`));
        }
        if (stats.daily_costs.bedrock_cost > 0) {
          console.log(chalk.gray(`  AI Processing: ${formatCurrency(stats.daily_costs.bedrock_cost)}`));
        }
      }

      // Recent queries
      if (stats.recent_queries && stats.recent_queries.length > 0) {
        console.log(chalk.bold('\n🕒 Recent Queries:'));
        stats.recent_queries.slice(0, 5).forEach((query, index) => {
          console.log(chalk.gray(`${index + 1}. ${query.query.substring(0, 50)}...`));
          console.log(chalk.gray(`   ${query.response_time_ms}ms - ${formatCurrency(query.cost)}`));
        });
      }

    } catch (error) {
      spinner.fail('Failed to load usage statistics');
      throw new CLIError(`Failed to load usage: ${error}`);
    }
  }

  async today() {
    await requireAuth();

    const spinner = ora('Loading today\'s usage...').start();

    try {
      const stats = await usageService.getUsageStats();

      spinner.succeed('Today\'s usage loaded');

      console.log(chalk.bold('\n📅 Today\'s Usage:'));

      // Usage progress bar
      const dailyUsage = stats.current_usage.daily_queries;
      const dailyLimit = stats.current_usage.daily_limit;
      const usagePercent = Math.round((dailyUsage / dailyLimit) * 100);

      console.log(chalk.white(`Queries: ${dailyUsage}/${dailyLimit} (${usagePercent}%)`));

      // Simple progress bar
      const barLength = 20;
      const filledLength = Math.round((dailyUsage / dailyLimit) * barLength);
      const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
      console.log(chalk.blue(`[${bar}]`));

      if (stats.daily_costs) {
        console.log(chalk.white(`Cost: ${formatCurrency(stats.daily_costs.total_cost)}`));
      }

      // Quota warnings
      if (usagePercent >= 80) {
        console.log(chalk.yellow('\n⚠️ You\'re approaching your daily quota limit!'));
      }

    } catch (error) {
      spinner.fail('Failed to load today\'s usage');
      throw new CLIError(`Failed to load today's usage: ${error}`);
    }
  }

  async quotas() {
    await requireAuth();

    const spinner = ora('Loading quota information...').start();

    try {
      const quotas = await usageService.getQuotaLimits();

      spinner.succeed('Quota information loaded');

      console.log(chalk.bold('\n📋 Quota Limits:'));

      console.log(chalk.white(`Daily limit: ${quotas.daily_limit} queries`));
      console.log(chalk.gray(`  Remaining: ${quotas.daily_remaining}`));
      console.log(chalk.gray(`  Resets: ${new Date(quotas.reset_times.daily_reset).toLocaleTimeString()}`));

      console.log(chalk.white(`Monthly limit: ${quotas.monthly_limit} queries`));
      console.log(chalk.gray(`  Remaining: ${quotas.monthly_remaining}`));
      console.log(chalk.gray(`  Resets: ${new Date(quotas.reset_times.monthly_reset).toLocaleDateString()}`));

      // Progress indicators
      const dailyPercent = formatPercentage(quotas.daily_limit - quotas.daily_remaining, quotas.daily_limit);
      const monthlyPercent = formatPercentage(quotas.monthly_limit - quotas.monthly_remaining, quotas.monthly_limit);

      console.log(chalk.bold('\n📊 Usage:'));
      console.log(chalk.gray(`Daily: ${dailyPercent} used`));
      console.log(chalk.gray(`Monthly: ${monthlyPercent} used`));

      // Rate limiting information
      console.log(chalk.bold('\n🚦 Rate Limits:'));
      console.log(chalk.white(`API requests: ${API_CONFIG.RATE_LIMIT.REQUESTS_PER_WINDOW} requests per ${API_CONFIG.RATE_LIMIT.WINDOW_MINUTES} minutes`));
      console.log(chalk.gray(`  Auto-retry: ${API_CONFIG.SECURITY.ENABLE_RETRY_ON_RATE_LIMIT ? 'Enabled' : 'Disabled'}`));
      console.log(chalk.gray(`  Max retry wait: ${API_CONFIG.RATE_LIMIT.MAX_RETRY_WAIT} seconds`));

      // Security settings
      console.log(chalk.bold('\n🔒 Security Settings:'));
      console.log(chalk.gray(`Max request size: ${Math.round(API_CONFIG.SECURITY.MAX_REQUEST_SIZE / (1024 * 1024))}MB`));
      console.log(chalk.gray(`Input validation: ${API_CONFIG.SECURITY.VALIDATE_INPUT ? 'Enabled' : 'Disabled'}`));

    } catch (error) {
      spinner.fail('Failed to load quota information');
      throw new CLIError(`Failed to load quotas: ${error}`);
    }
  }

  async costs(options: any = {}) {
    await requireAuth();

    const spinner = ora('Loading cost breakdown...').start();

    try {
      const costs = await usageService.getCostBreakdown(options.period);

      spinner.succeed('Cost breakdown loaded');

      if (options.json) {
        console.log(JSON.stringify(costs, null, 2));
        return;
      }

      console.log(chalk.bold(`\n💰 Cost Breakdown (${costs.period}):`));
      console.log(chalk.white(`Total: ${formatCurrency(costs.total_cost)}`));

      console.log(chalk.bold('\nBy Service:'));
      console.log(chalk.gray(`  Transcription: ${formatCurrency(costs.breakdown.transcribe_cost)}`));
      console.log(chalk.gray(`  AI Processing: ${formatCurrency(costs.breakdown.bedrock_cost)}`));
      console.log(chalk.gray(`  Storage: ${formatCurrency(costs.breakdown.storage_cost)}`));
      console.log(chalk.gray(`  Other: ${formatCurrency(costs.breakdown.other_costs)}`));

      console.log(chalk.bold('\nCost per Operation:'));
      console.log(chalk.gray(`  Voice query: ${formatCurrency(costs.cost_per_operation.voice_query)}`));
      console.log(chalk.gray(`  Text query: ${formatCurrency(costs.cost_per_operation.text_query)}`));
      console.log(chalk.gray(`  Manual upload: ${formatCurrency(costs.cost_per_operation.manual_upload)}`));
      console.log(chalk.gray(`  Manual download: ${formatCurrency(costs.cost_per_operation.manual_download)}`));

    } catch (error) {
      spinner.fail('Failed to load cost breakdown');
      throw new CLIError(`Failed to load costs: ${error}`);
    }
  }

  async history(options: any = {}) {
    await requireAuth();

    const spinner = ora('Loading usage history...').start();

    try {
      const days = parseInt(options.days) || 7;
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const history = await usageService.getUsageHistory(startDate, endDate);

      spinner.succeed(`Usage history loaded (${days} days)`);

      if (options.json) {
        console.log(JSON.stringify(history, null, 2));
        return;
      }

      console.log(chalk.bold(`\n📈 Usage History (Last ${days} days):`));
      console.log(chalk.white(`Total queries: ${history.total_queries}`));
      console.log(chalk.white(`Total cost: ${formatCurrency(history.total_cost)}`));

      if (history.daily_usage.length > 0) {
        console.log(chalk.bold('\nDaily Breakdown:'));

        const tableData = [
          ['Date', 'Queries', 'Cost']
        ];

        history.daily_usage.forEach(day => {
          tableData.push([
            chalk.gray(new Date(day.date).toLocaleDateString()),
            chalk.white(day.queries.toString()),
            chalk.gray(formatCurrency(day.cost))
          ]);
        });

        console.log('\n' + table(tableData));
      }

    } catch (error) {
      spinner.fail('Failed to load usage history');
      throw new CLIError(`Failed to load history: ${error}`);
    }
  }

  async export(options: any = {}) {
    await requireAuth();

    const spinner = ora('Exporting usage data...').start();

    try {
      const days = parseInt(options.days) || 30;
      const format = options.format || 'csv';
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const blob = await usageService.exportUsageData(startDate, endDate, format);

      // Convert blob to buffer (Node.js specific)
      const buffer = Buffer.from(await blob.arrayBuffer());

      // Determine output file
      const outputFile = options.output || `manuel-usage-${startDate}-to-${endDate}.${format}`;

      // Write file
      const fs = await import('fs/promises');
      await fs.writeFile(outputFile, buffer);

      spinner.succeed(`Usage data exported to ${outputFile}`);
      console.log(chalk.gray(`Format: ${format.toUpperCase()}`));
      console.log(chalk.gray(`Period: ${startDate} to ${endDate}`));

    } catch (error) {
      spinner.fail('Failed to export usage data');
      throw new CLIError(`Export failed: ${error}`);
    }
  }
}
