import { UsageService } from '../index';
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
}

export class MockUsageService implements UsageService {
  private userUsage = new Map<string, UserUsage>();

  constructor() {
    // Initialize with different usage data for different users
    this.userUsage.set('user1', {
      dailyQueries: 5,
      dailyLimit: 50,
      dailyRemaining: 45,
      dailyCost: 0.75,
      monthlyQueries: 125,
      monthlyLimit: 1000,
      monthlyRemaining: 875,
      monthlyCost: 18.50,
    });

    this.userUsage.set('user2', {
      dailyQueries: 12,
      dailyLimit: 50,
      dailyRemaining: 38,
      dailyCost: 1.85,
      monthlyQueries: 67,
      monthlyLimit: 1000,
      monthlyRemaining: 933,
      monthlyCost: 9.75,
    });

    this.userUsage.set('user3', {
      dailyQueries: 3,
      dailyLimit: 25,
      dailyRemaining: 22,
      dailyCost: 0.45,
      monthlyQueries: 89,
      monthlyLimit: 500,
      monthlyRemaining: 411,
      monthlyCost: 12.30,
    });
  }

  private getCurrentUserId(): string {
    return mockUserContext.getCurrentUserId();
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
      };
      this.userUsage.set(userId, usage);
    }
    return usage;
  }

  async getUsage() {
    await this.delay(1000);
    const currentUserId = this.getCurrentUserId();
    return { ...this.getUserUsage(currentUserId) };
  }

  async refreshUsage() {
    await this.delay(800);
    const currentUserId = this.getCurrentUserId();
    const usage = this.getUserUsage(currentUserId);
    
    // Simulate some changes
    usage.dailyQueries += Math.floor(Math.random() * 3);
    usage.dailyRemaining = Math.max(0, usage.dailyLimit - usage.dailyQueries);
    usage.dailyCost += Math.random() * 0.5;

    return { ...usage };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
