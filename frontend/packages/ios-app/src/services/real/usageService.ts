import { UsageService } from '../index';
import { usageService as sharedUsageService } from '@manuel/shared';
import { handleApiError } from './errorHandler';

export class RealUsageService implements UsageService {
  async getUsage() {
    try {
      const response = await sharedUsageService.getTodayUsage();

      // Transform response to match iOS app interface
      return {
        dailyQueries: response.daily_queries || response.queries_today || 0,
        dailyLimit: response.daily_limit || response.daily_quota || 50,
        dailyRemaining: response.daily_remaining || this.calculateRemaining(
          response.daily_limit || 50,
          response.daily_queries || 0
        ),
        dailyCost: response.daily_cost || response.cost_today || 0,
        monthlyQueries: response.monthly_queries || response.queries_month || 0,
        monthlyLimit: response.monthly_limit || response.monthly_quota || 1000,
        monthlyRemaining: response.monthly_remaining || this.calculateRemaining(
          response.monthly_limit || 1000,
          response.monthly_queries || 0
        ),
        monthlyCost: response.monthly_cost || response.cost_month || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'get usage');
    }
  }

  async refreshUsage() {
    try {
      // Force refresh from backend
      const response = await sharedUsageService.getTodayUsage(true); // true for force refresh

      return {
        dailyQueries: response.daily_queries || response.queries_today || 0,
        dailyLimit: response.daily_limit || response.daily_quota || 50,
        dailyRemaining: response.daily_remaining || this.calculateRemaining(
          response.daily_limit || 50,
          response.daily_queries || 0
        ),
        dailyCost: response.daily_cost || response.cost_today || 0,
        monthlyQueries: response.monthly_queries || response.queries_month || 0,
        monthlyLimit: response.monthly_limit || response.monthly_quota || 1000,
        monthlyRemaining: response.monthly_remaining || this.calculateRemaining(
          response.monthly_limit || 1000,
          response.monthly_queries || 0
        ),
        monthlyCost: response.monthly_cost || response.cost_month || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'refresh usage');
    }
  }

  // Get detailed usage history
  async getUsageHistory(days: number = 30) {
    try {
      const response = await sharedUsageService.getUsageHistory(days);
      return response;
    } catch (error) {
      throw handleApiError(error, 'get usage history');
    }
  }

  // Get usage breakdown by service
  async getUsageBreakdown() {
    try {
      const response = await sharedUsageService.getUsageBreakdown();
      return response;
    } catch (error) {
      throw handleApiError(error, 'get usage breakdown');
    }
  }

  // Check if user has quota remaining
  async hasQuotaRemaining(type: 'daily' | 'monthly' = 'daily'): Promise<boolean> {
    try {
      const usage = await this.getUsage();

      if (type === 'daily') {
        return usage.dailyRemaining > 0;
      } else {
        return usage.monthlyRemaining > 0;
      }
    } catch (error) {
      // If we can't check quota, assume they have quota to be permissive
      console.warn('Could not check quota:', error);
      return true;
    }
  }

  // Get quota status with rate limiting information
  async getQuotaStatus() {
    try {
      const usage = await this.getUsage();

      return {
        ...usage,
        // Add rate limiting info
        rateLimit: {
          requests_per_window: 50,
          window_minutes: 15,
          current_requests: 0, // Would come from backend
          reset_time: Date.now() + (15 * 60 * 1000), // 15 minutes from now
        },
        warnings: this.generateWarnings(usage),
      };
    } catch (error) {
      throw handleApiError(error, 'get quota status');
    }
  }

  private calculateRemaining(limit: number, used: number): number {
    return Math.max(0, limit - used);
  }

  private generateWarnings(usage: any): string[] {
    const warnings: string[] = [];

    // Daily quota warnings
    const dailyPercentUsed = (usage.dailyQueries / usage.dailyLimit) * 100;
    if (dailyPercentUsed >= 90) {
      warnings.push('Daily quota nearly exhausted');
    } else if (dailyPercentUsed >= 75) {
      warnings.push('Daily quota running low');
    }

    // Monthly quota warnings
    const monthlyPercentUsed = (usage.monthlyQueries / usage.monthlyLimit) * 100;
    if (monthlyPercentUsed >= 90) {
      warnings.push('Monthly quota nearly exhausted');
    } else if (monthlyPercentUsed >= 75) {
      warnings.push('Monthly quota running low');
    }

    return warnings;
  }
}
