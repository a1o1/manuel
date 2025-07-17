import { UsageService } from '../interfaces';
import { mockUserContext } from './userContext';

interface UserUsage {
  dailyQueries: number;
  dailyLimit: number;
  dailyRemaining: number;
  dailyCost: number;
  monthlyQueries: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  monthlyCost: number;
  currency: string;
  costBreakdown: {
    transcribe: number;
    bedrock: number;
    lambda: number;
    s3: number;
    apiGateway: number;
  };
  recentQueries: Array<{
    timestamp: string;
    operation: string;
    cost: number;
    currency: string;
  }>;
  historicalData: Array<{
    date: string;
    count: number;
    operations: Record<string, number>;
  }>;
  operationBreakdown: {
    transcribe: number;
    query: number;
    total: number;
  };
}

export class MockUsageService implements UsageService {
  private userUsage = new Map<string, UserUsage>();

  constructor() {
    // Initialize with different usage data for different users (EUR currency)
    this.userUsage.set('user1', {
      dailyQueries: 5,
      dailyLimit: 50,
      dailyRemaining: 45,
      dailyCost: 0.64,  // EUR
      monthlyQueries: 125,
      monthlyLimit: 1000,
      monthlyRemaining: 875,
      monthlyCost: 15.73,  // EUR
      currency: 'EUR',
      costBreakdown: {
        transcribe: 0.12,
        bedrock: 0.45,
        lambda: 0.03,
        s3: 0.02,
        apiGateway: 0.02,
      },
      recentQueries: [
        { timestamp: '2025-01-17T10:30:00Z', operation: 'query', cost: 0.15, currency: 'EUR' },
        { timestamp: '2025-01-17T09:15:00Z', operation: 'transcribe', cost: 0.08, currency: 'EUR' },
        { timestamp: '2025-01-17T08:45:00Z', operation: 'query', cost: 0.12, currency: 'EUR' },
      ],
      historicalData: this.generateHistoricalData(),
      operationBreakdown: { transcribe: 2, query: 3, total: 5 },
    });

    this.userUsage.set('user2', {
      dailyQueries: 12,
      dailyLimit: 50,
      dailyRemaining: 38,
      dailyCost: 1.57,  // EUR
      monthlyQueries: 67,
      monthlyLimit: 1000,
      monthlyRemaining: 933,
      monthlyCost: 8.29,  // EUR
      currency: 'EUR',
      costBreakdown: {
        transcribe: 0.28,
        bedrock: 1.15,
        lambda: 0.07,
        s3: 0.04,
        apiGateway: 0.03,
      },
      recentQueries: [
        { timestamp: '2025-01-17T11:00:00Z', operation: 'query', cost: 0.18, currency: 'EUR' },
        { timestamp: '2025-01-17T10:45:00Z', operation: 'transcribe', cost: 0.11, currency: 'EUR' },
        { timestamp: '2025-01-17T10:20:00Z', operation: 'query', cost: 0.14, currency: 'EUR' },
      ],
      historicalData: this.generateHistoricalData(),
      operationBreakdown: { transcribe: 5, query: 7, total: 12 },
    });

    this.userUsage.set('user3', {
      dailyQueries: 3,
      dailyLimit: 25,
      dailyRemaining: 22,
      dailyCost: 0.38,  // EUR
      monthlyQueries: 89,
      monthlyLimit: 500,
      monthlyRemaining: 411,
      monthlyCost: 10.46,  // EUR
      currency: 'EUR',
      costBreakdown: {
        transcribe: 0.07,
        bedrock: 0.26,
        lambda: 0.02,
        s3: 0.02,
        apiGateway: 0.01,
      },
      recentQueries: [
        { timestamp: '2025-01-17T09:30:00Z', operation: 'query', cost: 0.13, currency: 'EUR' },
        { timestamp: '2025-01-17T08:15:00Z', operation: 'query', cost: 0.11, currency: 'EUR' },
        { timestamp: '2025-01-17T07:45:00Z', operation: 'transcribe', cost: 0.09, currency: 'EUR' },
      ],
      historicalData: this.generateHistoricalData(),
      operationBreakdown: { transcribe: 1, query: 2, total: 3 },
    });
  }

  private getCurrentUserId(): string {
    return mockUserContext.getCurrentUserId();
  }

  private generateHistoricalData() {
    const data = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const count = Math.floor(Math.random() * 15) + 1;
      data.push({
        date: dateStr,
        count,
        operations: {
          query: Math.floor(count * 0.7),
          transcribe: Math.floor(count * 0.3),
        }
      });
    }

    return data;
  }

  private getUserUsage(userId: string): UserUsage {
    let usage = this.userUsage.get(userId);
    if (!usage) {
      // Create default usage for new user
      usage = {
        dailyQueries: 0,
        dailyLimit: 50,
        dailyRemaining: 50,
        dailyCost: 0.00,
        monthlyQueries: 0,
        monthlyLimit: 1000,
        monthlyRemaining: 1000,
        monthlyCost: 0.00,
        currency: 'EUR',
        costBreakdown: {
          transcribe: 0,
          bedrock: 0,
          lambda: 0,
          s3: 0,
          apiGateway: 0,
        },
        recentQueries: [],
        historicalData: this.generateHistoricalData(),
        operationBreakdown: { transcribe: 0, query: 0, total: 0 },
      };
      this.userUsage.set(userId, usage);
    }
    return usage;
  }

  async getUsage() {
    // Legacy method - calls getUsageData() for backward compatibility
    const data = await this.getUsageData();
    console.log('Mock getUsage() returning:', JSON.stringify(data, null, 2));
    return data;
  }

  async getUsageData(period?: string) {
    await this.delay(1000);
    const currentUserId = this.getCurrentUserId();
    return { ...this.getUserUsage(currentUserId) };
  }

  async getQuotas() {
    await this.delay(800);
    const currentUserId = this.getCurrentUserId();
    const usage = this.getUserUsage(currentUserId);

    const dailyPercentUsed = (usage.dailyQueries / usage.dailyLimit) * 100;
    const monthlyPercentUsed = (usage.monthlyQueries / usage.monthlyLimit) * 100;

    let status = 'OK';
    if (dailyPercentUsed >= 90 || monthlyPercentUsed >= 90) {
      status = 'CRITICAL';
    } else if (dailyPercentUsed >= 75 || monthlyPercentUsed >= 75) {
      status = 'WARNING';
    } else if (dailyPercentUsed >= 50 || monthlyPercentUsed >= 50) {
      status = 'MODERATE';
    }

    return {
      daily: {
        limit: usage.dailyLimit,
        used: usage.dailyQueries,
        remaining: usage.dailyRemaining,
        percentUsed: dailyPercentUsed,
      },
      monthly: {
        limit: usage.monthlyLimit,
        used: usage.monthlyQueries,
        remaining: usage.monthlyRemaining,
        percentUsed: monthlyPercentUsed,
      },
      status,
      lastOperation: 'query',
      lastUpdated: new Date().toISOString(),
    };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
