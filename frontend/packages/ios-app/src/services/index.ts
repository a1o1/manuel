// Service factory - switches between mock and real implementations
import { ENV_CONFIG } from '../config/environment';

// Import real services (will be created when backend is ready)
// import { RealAuthService } from './real/authService';
// import { RealUsageService } from './real/usageService';
// import { RealQueryService } from './real/queryService';
// import { RealManualsService } from './real/manualsService';

// Import mock services
import { MockAuthService } from './mock/authService';
import { MockUsageService } from './mock/usageService';
import { MockQueryService } from './mock/queryService';
import { MockManualsService } from './mock/manualsService';

// Service interfaces (contracts)
export interface AuthService {
  login(email: string, password: string): Promise<{ user: any; token: string }>;
  signup(email: string, password: string, name: string): Promise<{ user: any; token: string }>;
  confirmSignup(email: string, code: string): Promise<void>;
  resendConfirmationCode(email: string): Promise<void>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<any>;
  forgotPassword(email: string): Promise<void>;
}

export interface UsageService {
  getUsage(): Promise<any>;
  refreshUsage(): Promise<any>;
}

export interface QueryService {
  textQuery(query: string, options?: any): Promise<any>;
  voiceQuery(audioBlob: Blob, options?: any): Promise<any>;
}

export interface ManualsService {
  getManuals(): Promise<any[]>;
  uploadManual(file: File): Promise<any>;
  deleteManual(id: string): Promise<void>;
  getManualDetail(id: string): Promise<any>;
}

// Service factory functions
export const createAuthService = (): AuthService => {
  if (ENV_CONFIG.FEATURES.MOCK_AUTH) {
    return new MockAuthService();
  }
  // return new RealAuthService();
  throw new Error('Real auth service not implemented yet');
};

export const createUsageService = (): UsageService => {
  if (ENV_CONFIG.FEATURES.MOCK_USAGE) {
    return new MockUsageService();
  }
  // return new RealUsageService();
  throw new Error('Real usage service not implemented yet');
};

export const createQueryService = (): QueryService => {
  if (ENV_CONFIG.FEATURES.MOCK_QUERIES) {
    return new MockQueryService();
  }
  // return new RealQueryService();
  throw new Error('Real query service not implemented yet');
};

export const createManualsService = (): ManualsService => {
  if (ENV_CONFIG.FEATURES.MOCK_MANUALS) {
    return new MockManualsService();
  }
  // return new RealManualsService();
  throw new Error('Real manuals service not implemented yet');
};

// Export singleton instances
export const authService = createAuthService();
export const usageService = createUsageService();
export const queryService = createQueryService();
export const manualsService = createManualsService();
