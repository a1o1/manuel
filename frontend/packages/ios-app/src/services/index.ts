// Service factory - switches between mock and real implementations
import { ENV_CONFIG } from '../config/environment';
import { Platform } from 'react-native';

// Import real services
import { RealAuthService } from './real/authService';
import { RealUsageService } from './real/usageService';
import { RealQueryService } from './real/queryService';
import { RealManualsService } from './real/manualsService';

// Import mock services
import { MockAuthService } from './mock/authService';
import { MockUsageService } from './mock/usageService';
import { MockQueryService } from './mock/queryService';
import { MockManualsService } from './mock/manualsService';

// Import web services (lazy loaded)
const getWebServices = () => {
  if (Platform.OS === 'web') {
    return {
      WebAuthService: require('./web/authService').WebAuthService,
      WebUsageService: require('./web/usageService').WebUsageService,
      WebQueryService: require('./web/queryService').WebQueryService,
      WebManualsService: require('./web/manualsService').WebManualsService,
    };
  }
  return null;
};

// Re-export interfaces
export * from './interfaces';
import type { AuthService, UsageService, QueryService, ManualsService } from './interfaces';

// Service factory functions
export const createAuthService = (): AuthService => {
  if (ENV_CONFIG.FEATURES.MOCK_AUTH) {
    return new MockAuthService();
  }

  // Use web services for web platform
  if (Platform.OS === 'web') {
    const webServices = getWebServices();
    if (webServices) {
      return new webServices.WebAuthService();
    }
  }

  return new RealAuthService();
};

export const createUsageService = (): UsageService => {
  if (ENV_CONFIG.FEATURES.MOCK_USAGE) {
    return new MockUsageService();
  }

  // Use web services for web platform
  if (Platform.OS === 'web') {
    const webServices = getWebServices();
    if (webServices) {
      return new webServices.WebUsageService();
    }
  }

  return new RealUsageService();
};

export const createQueryService = (): QueryService => {
  if (ENV_CONFIG.FEATURES.MOCK_QUERIES) {
    return new MockQueryService();
  }

  // Use web services for web platform
  if (Platform.OS === 'web') {
    const webServices = getWebServices();
    if (webServices) {
      return new webServices.WebQueryService();
    }
  }

  return new RealQueryService();
};

export const createManualsService = (): ManualsService => {
  if (ENV_CONFIG.FEATURES.MOCK_MANUALS) {
    return new MockManualsService();
  }

  // Use web services for web platform
  if (Platform.OS === 'web') {
    const webServices = getWebServices();
    if (webServices) {
      return new webServices.WebManualsService();
    }
  }

  return new RealManualsService();
};

// Export singleton instances
export const authService = createAuthService();
export const usageService = createUsageService();
export const queryService = createQueryService();
export const manualsService = createManualsService();
