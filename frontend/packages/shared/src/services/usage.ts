import { apiService } from './api';
import {
  UsageStats,
  UsageInfo,
  CostInfo,
  RecentQuery,
  ApiResponse,
} from '../types';

class UsageService {
  // Get current usage statistics
  async getUsageStats(): Promise<UsageStats> {
    const response = await apiService.get<ApiResponse<UsageStats>>('/api/usage');
    return response.data!;
  }

  // Get usage for a specific date range
  async getUsageHistory(startDate: string, endDate: string): Promise<{
    daily_usage: Array<{
      date: string;
      queries: number;
      cost: number;
    }>;
    total_queries: number;
    total_cost: number;
  }> {
    const response = await apiService.get<ApiResponse<{
      daily_usage: Array<{
        date: string;
        queries: number;
        cost: number;
      }>;
      total_queries: number;
      total_cost: number;
    }>>(`/api/usage/history?start=${startDate}&end=${endDate}`);
    return response.data!;
  }

  // Get cost breakdown
  async getCostBreakdown(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<{
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
  }> {
    const response = await apiService.get<ApiResponse<{
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
    }>>(`/api/usage/costs?period=${period}`);
    return response.data!;
  }

  // Get quota limits
  async getQuotaLimits(): Promise<{
    daily_limit: number;
    monthly_limit: number;
    daily_remaining: number;
    monthly_remaining: number;
    reset_times: {
      daily_reset: string;
      monthly_reset: string;
    };
  }> {
    const response = await apiService.get<ApiResponse<{
      daily_limit: number;
      monthly_limit: number;
      daily_remaining: number;
      monthly_remaining: number;
      reset_times: {
        daily_reset: string;
        monthly_reset: string;
      };
    }>>('/api/usage/quotas');
    return response.data!;
  }

  // Get recent query history
  async getRecentQueries(limit = 10): Promise<RecentQuery[]> {
    const response = await apiService.get<ApiResponse<{ queries: RecentQuery[] }>>(
      `/api/usage/recent?limit=${limit}`
    );
    return response.data?.queries || [];
  }

  // Export usage data
  async exportUsageData(
    startDate: string,
    endDate: string,
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob> {
    const response = await apiService.get(
      `/api/usage/export?start=${startDate}&end=${endDate}&format=${format}`,
      { responseType: 'blob' }
    );
    return response as unknown as Blob;
  }
}

export const usageService = new UsageService();
