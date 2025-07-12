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
exports.UsageCommand = void 0;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const table_1 = require("table");
const shared_1 = require("@manuel/shared");
const error_1 = require("../utils/error");
const formatting_1 = require("../utils/formatting");
const auth_1 = require("../utils/auth");
class UsageCommand {
    static register(program) {
        const usage = new UsageCommand();
        program
            .command('overview')
            .alias('stats')
            .description('Show usage overview')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
            await (0, error_1.handleError)(() => usage.overview(options));
        });
        program
            .command('today')
            .description('Show today\'s usage')
            .action(async () => {
            await (0, error_1.handleError)(() => usage.today());
        });
        program
            .command('quotas')
            .description('Show quota limits and remaining usage')
            .action(async () => {
            await (0, error_1.handleError)(() => usage.quotas());
        });
        program
            .command('costs')
            .description('Show cost breakdown')
            .option('-p, --period <period>', 'Time period (daily|weekly|monthly)', 'daily')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
            await (0, error_1.handleError)(() => usage.costs(options));
        });
        program
            .command('history')
            .description('Show usage history')
            .option('-d, --days <days>', 'Number of days to show', '7')
            .option('--json', 'Output as JSON')
            .action(async (options) => {
            await (0, error_1.handleError)(() => usage.history(options));
        });
        program
            .command('export')
            .description('Export usage data')
            .option('-d, --days <days>', 'Number of days to export', '30')
            .option('-f, --format <format>', 'Export format (csv|json)', 'csv')
            .option('-o, --output <file>', 'Output file path')
            .action(async (options) => {
            await (0, error_1.handleError)(() => usage.export(options));
        });
    }
    async overview(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading usage statistics...').start();
        try {
            const stats = await shared_1.usageService.getUsageStats();
            spinner.succeed('Usage statistics loaded');
            if (options.json) {
                console.log(JSON.stringify(stats, null, 2));
                return;
            }
            // Current usage
            console.log(chalk_1.default.bold('\n📊 Current Usage:'));
            console.log(chalk_1.default.white(`Daily queries: ${stats.current_usage.daily_queries}/${stats.current_usage.daily_limit}`));
            console.log(chalk_1.default.gray(`  Remaining: ${stats.current_usage.daily_remaining}`));
            console.log(chalk_1.default.white(`Monthly queries: ${stats.current_usage.monthly_queries}/${stats.current_usage.monthly_limit}`));
            console.log(chalk_1.default.gray(`  Remaining: ${stats.current_usage.monthly_remaining}`));
            // Daily costs
            if (stats.daily_costs) {
                console.log(chalk_1.default.bold('\n💰 Today\'s Costs:'));
                console.log(chalk_1.default.white(`Total: ${(0, formatting_1.formatCurrency)(stats.daily_costs.total_cost)}`));
                if (stats.daily_costs.transcribe_cost > 0) {
                    console.log(chalk_1.default.gray(`  Transcription: ${(0, formatting_1.formatCurrency)(stats.daily_costs.transcribe_cost)}`));
                }
                if (stats.daily_costs.bedrock_cost > 0) {
                    console.log(chalk_1.default.gray(`  AI Processing: ${(0, formatting_1.formatCurrency)(stats.daily_costs.bedrock_cost)}`));
                }
            }
            // Recent queries
            if (stats.recent_queries && stats.recent_queries.length > 0) {
                console.log(chalk_1.default.bold('\n🕒 Recent Queries:'));
                stats.recent_queries.slice(0, 5).forEach((query, index) => {
                    console.log(chalk_1.default.gray(`${index + 1}. ${query.query.substring(0, 50)}...`));
                    console.log(chalk_1.default.gray(`   ${query.response_time_ms}ms - ${(0, formatting_1.formatCurrency)(query.cost)}`));
                });
            }
        }
        catch (error) {
            spinner.fail('Failed to load usage statistics');
            throw new error_1.CLIError(`Failed to load usage: ${error}`);
        }
    }
    async today() {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading today\'s usage...').start();
        try {
            const stats = await shared_1.usageService.getUsageStats();
            spinner.succeed('Today\'s usage loaded');
            console.log(chalk_1.default.bold('\n📅 Today\'s Usage:'));
            // Usage progress bar
            const dailyUsage = stats.current_usage.daily_queries;
            const dailyLimit = stats.current_usage.daily_limit;
            const usagePercent = Math.round((dailyUsage / dailyLimit) * 100);
            console.log(chalk_1.default.white(`Queries: ${dailyUsage}/${dailyLimit} (${usagePercent}%)`));
            // Simple progress bar
            const barLength = 20;
            const filledLength = Math.round((dailyUsage / dailyLimit) * barLength);
            const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
            console.log(chalk_1.default.blue(`[${bar}]`));
            if (stats.daily_costs) {
                console.log(chalk_1.default.white(`Cost: ${(0, formatting_1.formatCurrency)(stats.daily_costs.total_cost)}`));
            }
            // Quota warnings
            if (usagePercent >= 80) {
                console.log(chalk_1.default.yellow('\n⚠️ You\'re approaching your daily quota limit!'));
            }
        }
        catch (error) {
            spinner.fail('Failed to load today\'s usage');
            throw new error_1.CLIError(`Failed to load today's usage: ${error}`);
        }
    }
    async quotas() {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading quota information...').start();
        try {
            const quotas = await shared_1.usageService.getQuotaLimits();
            spinner.succeed('Quota information loaded');
            console.log(chalk_1.default.bold('\n📋 Quota Limits:'));
            console.log(chalk_1.default.white(`Daily limit: ${quotas.daily_limit} queries`));
            console.log(chalk_1.default.gray(`  Remaining: ${quotas.daily_remaining}`));
            console.log(chalk_1.default.gray(`  Resets: ${new Date(quotas.reset_times.daily_reset).toLocaleTimeString()}`));
            console.log(chalk_1.default.white(`Monthly limit: ${quotas.monthly_limit} queries`));
            console.log(chalk_1.default.gray(`  Remaining: ${quotas.monthly_remaining}`));
            console.log(chalk_1.default.gray(`  Resets: ${new Date(quotas.reset_times.monthly_reset).toLocaleDateString()}`));
            // Progress indicators
            const dailyPercent = (0, formatting_1.formatPercentage)(quotas.daily_limit - quotas.daily_remaining, quotas.daily_limit);
            const monthlyPercent = (0, formatting_1.formatPercentage)(quotas.monthly_limit - quotas.monthly_remaining, quotas.monthly_limit);
            console.log(chalk_1.default.bold('\n📊 Usage:'));
            console.log(chalk_1.default.gray(`Daily: ${dailyPercent} used`));
            console.log(chalk_1.default.gray(`Monthly: ${monthlyPercent} used`));
        }
        catch (error) {
            spinner.fail('Failed to load quota information');
            throw new error_1.CLIError(`Failed to load quotas: ${error}`);
        }
    }
    async costs(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading cost breakdown...').start();
        try {
            const costs = await shared_1.usageService.getCostBreakdown(options.period);
            spinner.succeed('Cost breakdown loaded');
            if (options.json) {
                console.log(JSON.stringify(costs, null, 2));
                return;
            }
            console.log(chalk_1.default.bold(`\n💰 Cost Breakdown (${costs.period}):`));
            console.log(chalk_1.default.white(`Total: ${(0, formatting_1.formatCurrency)(costs.total_cost)}`));
            console.log(chalk_1.default.bold('\nBy Service:'));
            console.log(chalk_1.default.gray(`  Transcription: ${(0, formatting_1.formatCurrency)(costs.breakdown.transcribe_cost)}`));
            console.log(chalk_1.default.gray(`  AI Processing: ${(0, formatting_1.formatCurrency)(costs.breakdown.bedrock_cost)}`));
            console.log(chalk_1.default.gray(`  Storage: ${(0, formatting_1.formatCurrency)(costs.breakdown.storage_cost)}`));
            console.log(chalk_1.default.gray(`  Other: ${(0, formatting_1.formatCurrency)(costs.breakdown.other_costs)}`));
            console.log(chalk_1.default.bold('\nCost per Operation:'));
            console.log(chalk_1.default.gray(`  Voice query: ${(0, formatting_1.formatCurrency)(costs.cost_per_operation.voice_query)}`));
            console.log(chalk_1.default.gray(`  Text query: ${(0, formatting_1.formatCurrency)(costs.cost_per_operation.text_query)}`));
            console.log(chalk_1.default.gray(`  Manual upload: ${(0, formatting_1.formatCurrency)(costs.cost_per_operation.manual_upload)}`));
            console.log(chalk_1.default.gray(`  Manual download: ${(0, formatting_1.formatCurrency)(costs.cost_per_operation.manual_download)}`));
        }
        catch (error) {
            spinner.fail('Failed to load cost breakdown');
            throw new error_1.CLIError(`Failed to load costs: ${error}`);
        }
    }
    async history(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Loading usage history...').start();
        try {
            const days = parseInt(options.days) || 7;
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const history = await shared_1.usageService.getUsageHistory(startDate, endDate);
            spinner.succeed(`Usage history loaded (${days} days)`);
            if (options.json) {
                console.log(JSON.stringify(history, null, 2));
                return;
            }
            console.log(chalk_1.default.bold(`\n📈 Usage History (Last ${days} days):`));
            console.log(chalk_1.default.white(`Total queries: ${history.total_queries}`));
            console.log(chalk_1.default.white(`Total cost: ${(0, formatting_1.formatCurrency)(history.total_cost)}`));
            if (history.daily_usage.length > 0) {
                console.log(chalk_1.default.bold('\nDaily Breakdown:'));
                const tableData = [
                    ['Date', 'Queries', 'Cost']
                ];
                history.daily_usage.forEach(day => {
                    tableData.push([
                        chalk_1.default.gray(new Date(day.date).toLocaleDateString()),
                        chalk_1.default.white(day.queries.toString()),
                        chalk_1.default.gray((0, formatting_1.formatCurrency)(day.cost))
                    ]);
                });
                console.log('\n' + (0, table_1.table)(tableData));
            }
        }
        catch (error) {
            spinner.fail('Failed to load usage history');
            throw new error_1.CLIError(`Failed to load history: ${error}`);
        }
    }
    async export(options = {}) {
        await (0, auth_1.requireAuth)();
        const spinner = (0, ora_1.default)('Exporting usage data...').start();
        try {
            const days = parseInt(options.days) || 30;
            const format = options.format || 'csv';
            const endDate = new Date().toISOString().split('T')[0];
            const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const blob = await shared_1.usageService.exportUsageData(startDate, endDate, format);
            // Convert blob to buffer (Node.js specific)
            const buffer = Buffer.from(await blob.arrayBuffer());
            // Determine output file
            const outputFile = options.output || `manuel-usage-${startDate}-to-${endDate}.${format}`;
            // Write file
            const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
            await fs.writeFile(outputFile, buffer);
            spinner.succeed(`Usage data exported to ${outputFile}`);
            console.log(chalk_1.default.gray(`Format: ${format.toUpperCase()}`));
            console.log(chalk_1.default.gray(`Period: ${startDate} to ${endDate}`));
        }
        catch (error) {
            spinner.fail('Failed to export usage data');
            throw new error_1.CLIError(`Export failed: ${error}`);
        }
    }
}
exports.UsageCommand = UsageCommand;
//# sourceMappingURL=usage.js.map