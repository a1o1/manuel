import { UsageService } from '../index';

export class MockUsageService implements UsageService {
  private mockUsage = {
    dailyQueries: 5,
    dailyLimit: 50,
    dailyRemaining: 45,
    dailyCost: 0.75,
    monthlyQueries: 125,
    monthlyLimit: 1000,
    monthlyRemaining: 875,
    monthlyCost: 18.50,
  };

  async getUsage() {
    await this.delay(1000);
    return this.mockUsage;
  }

  async refreshUsage() {
    await this.delay(800);
    // Simulate some changes
    this.mockUsage.dailyQueries += Math.floor(Math.random() * 3);
    this.mockUsage.dailyRemaining = Math.max(0, this.mockUsage.dailyLimit - this.mockUsage.dailyQueries);
    this.mockUsage.dailyCost += Math.random() * 0.5;

    return this.mockUsage;
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
