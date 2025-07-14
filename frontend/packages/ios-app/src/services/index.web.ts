// Web-specific service exports that don't import from @manuel/shared
import { ENV_CONFIG } from '../config/environment';

// Import web services
import { WebAuthService } from './web/authService';
import { WebUsageService } from './web/usageService';
import { WebQueryService } from './web/queryService';
import { WebManualsService } from './web/manualsService';

// Import mock services
import { MockAuthService } from './mock/authService';
import { MockUsageService } from './mock/usageService';
import { MockQueryService } from './mock/queryService';
import { MockManualsService } from './mock/manualsService';

// Re-export interfaces
export * from './interfaces';

// Service factory functions for web
export const createAuthService = () => {
  if (ENV_CONFIG.FEATURES.MOCK_AUTH) {
    return new MockAuthService();
  }
  return new WebAuthService();
};

export const createUsageService = () => {
  if (ENV_CONFIG.FEATURES.MOCK_USAGE) {
    return new MockUsageService();
  }
  return new WebUsageService();
};

export const createQueryService = () => {
  if (ENV_CONFIG.FEATURES.MOCK_QUERIES) {
    return new MockQueryService();
  }
  return new WebQueryService();
};

export const createManualsService = () => {
  if (ENV_CONFIG.FEATURES.MOCK_MANUALS) {
    return new MockManualsService();
  }
  return new WebManualsService();
};

// Export singleton instances
export const authService = createAuthService();
export const usageService = createUsageService();
export const queryService = createQueryService();
export const manualsService = createManualsService();
