// Stub implementation for iOS - uses mocks only
import { UsageService } from '../interfaces';

export class RealUsageService implements UsageService {
  async getUsageData(period?: string) {
    throw new Error('Use mock mode for iOS development');
  }

  async getQuotas() {
    throw new Error('Use mock mode for iOS development');
  }
}