import { UsageService } from '../interfaces';
import { BaseApi } from '../api/baseApi';

export interface UsageResponse {
  current_usage: {
    daily_queries: number;
    daily_limit: number;
    daily_remaining: number;
    monthly_queries: number;
    monthly_limit: number;
    monthly_remaining: number;
  };
  daily_costs: {
    total_cost: number;
    transcribe_cost: number;
    bedrock_cost: number;
    lambda_cost: number;
    s3_cost: number;
    api_gateway_cost: number;
    currency: string;
  };
  monthly_costs: {
    total_cost: number;
    service_breakdown: Record<string, number>;
    currency: string;
  };
  recent_queries: Array<{
    timestamp: string;
    operation: string;
    cost: number;
    currency: string;
  }>;
  historical: Array<{
    date: string;
    daily_count: number;
    operations: Record<string, number>;
  }>;
  breakdown: {
    transcribe: number;
    query: number;
    total: number;
  };
}

export interface QuotaResponse {
  quotas: {
    daily: {
      limit: number;
      used: number;
      remaining: number;
      percent_used: number;
    };
    monthly: {
      limit: number;
      used: number;
      remaining: number;
      percent_used: number;
    };
  };
  status: string;
  last_operation?: string;
  last_updated?: string;
}

export class RealUsageService extends BaseApi implements UsageService {
  async getUsage() {
    // Legacy method - calls getUsageData() for backward compatibility
    return this.getUsageData();
  }

  async getUsageData(period?: string) {
    try {
      const response = await this.get<UsageResponse>('/api/user/usage');

      if (response.error) {
        console.error('Backend error:', response.error);
        throw new Error(response.error);
      }

      if (!response.data) {
        console.error('No data in response:', response);
        throw new Error('No usage data received from backend');
      }

      const data = response.data;
      console.log('Backend usage response:', data);

      return {
        dailyQueries: data.current_usage?.daily_queries || 0,
        dailyLimit: data.current_usage?.daily_limit || 50,
        dailyRemaining: data.current_usage?.daily_remaining || 50,
        monthlyQueries: data.current_usage?.monthly_queries || 0,
        monthlyLimit: data.current_usage?.monthly_limit || 1000,
        monthlyRemaining: data.current_usage?.monthly_remaining || 1000,
        dailyCost: data.daily_costs?.total_cost || 0,
        monthlyCost: data.monthly_costs?.total_cost || 0,
        currency: data.daily_costs?.currency || 'EUR',
        costBreakdown: {
          transcribe: data.daily_costs?.transcribe_cost || 0,
          bedrock: data.daily_costs?.bedrock_cost || 0,
          lambda: data.daily_costs?.lambda_cost || 0,
          s3: data.daily_costs?.s3_cost || 0,
          apiGateway: data.daily_costs?.api_gateway_cost || 0,
        },
        recentQueries: (data.recent_queries || []).map(query => ({
          timestamp: query.timestamp,
          operation: query.operation,
          cost: query.cost,
          currency: query.currency,
        })),
        historicalData: (data.historical || []).map(day => ({
          date: day.date,
          count: day.daily_count,
          operations: day.operations,
        })),
        operationBreakdown: data.breakdown || { transcribe: 0, query: 0, total: 0 },
      };
    } catch (error) {
      console.error('Error fetching usage data:', error);
      // Return fallback data instead of throwing error
      return {
        dailyQueries: 0,
        dailyLimit: 50,
        dailyRemaining: 50,
        monthlyQueries: 0,
        monthlyLimit: 1000,
        monthlyRemaining: 1000,
        dailyCost: 0,
        monthlyCost: 0,
        currency: 'EUR',
        costBreakdown: {
          transcribe: 0,
          bedrock: 0,
          lambda: 0,
          s3: 0,
          apiGateway: 0,
        },
        recentQueries: [],
        historicalData: [],
        operationBreakdown: { transcribe: 0, query: 0, total: 0 },
      };
    }
  }

  async getQuotas() {
    try {
      const response = await this.get<QuotaResponse>('/api/user/quota');

      if (response.error) {
        console.error('Backend quota error:', response.error);
        throw new Error(response.error);
      }

      if (!response.data) {
        console.error('No data in quota response:', response);
        throw new Error('No quota data received from backend');
      }

      const data = response.data;
      console.log('Backend quota response:', data);

      return {
        daily: {
          limit: data.quotas?.daily?.limit || 50,
          used: data.quotas?.daily?.used || 0,
          remaining: data.quotas?.daily?.remaining || 50,
          percentUsed: data.quotas?.daily?.percent_used || 0,
        },
        monthly: {
          limit: data.quotas?.monthly?.limit || 1000,
          used: data.quotas?.monthly?.used || 0,
          remaining: data.quotas?.monthly?.remaining || 1000,
          percentUsed: data.quotas?.monthly?.percent_used || 0,
        },
        status: data.status || 'OK',
        lastOperation: data.last_operation,
        lastUpdated: data.last_updated,
      };
    } catch (error) {
      console.error('Error fetching quota data:', error);
      // Return fallback data instead of throwing error
      return {
        daily: {
          limit: 50,
          used: 0,
          remaining: 50,
          percentUsed: 0,
        },
        monthly: {
          limit: 1000,
          used: 0,
          remaining: 1000,
          percentUsed: 0,
        },
        status: 'OK',
        lastOperation: undefined,
        lastUpdated: undefined,
      };
    }
  }
}
