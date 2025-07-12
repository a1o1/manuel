import { UsageStats, RecentQuery } from '../types';
declare class UsageService {
    getUsageStats(): Promise<UsageStats>;
    getUsageHistory(startDate: string, endDate: string): Promise<{
        daily_usage: Array<{
            date: string;
            queries: number;
            cost: number;
        }>;
        total_queries: number;
        total_cost: number;
    }>;
    getCostBreakdown(period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        period: string;
        total_cost: number;
        breakdown: {
            transcribe_cost: number;
            bedrock_cost: number;
            storage_cost: number;
            other_costs: number;
        };
        cost_per_operation: {
            voice_query: number;
            text_query: number;
            manual_upload: number;
            manual_download: number;
        };
    }>;
    getQuotaLimits(): Promise<{
        daily_limit: number;
        monthly_limit: number;
        daily_remaining: number;
        monthly_remaining: number;
        reset_times: {
            daily_reset: string;
            monthly_reset: string;
        };
    }>;
    getRecentQueries(limit?: number): Promise<RecentQuery[]>;
    exportUsageData(startDate: string, endDate: string, format?: 'csv' | 'json'): Promise<Blob>;
}
export declare const usageService: UsageService;
export {};
//# sourceMappingURL=usage.d.ts.map