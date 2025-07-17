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
  // Legacy method for backward compatibility
  getUsage(): Promise<{
    dailyQueries: number;
    dailyLimit: number;
    dailyRemaining: number;
    monthlyQueries: number;
    monthlyLimit: number;
    monthlyRemaining: number;
    dailyCost: number;
    monthlyCost: number;
    currency: string;
    costBreakdown?: {
      transcribe: number;
      bedrock: number;
      lambda: number;
      s3: number;
      apiGateway: number;
    };
    recentQueries?: Array<{
      timestamp: string;
      operation: string;
      cost: number;
      currency: string;
    }>;
    historicalData?: Array<{
      date: string;
      count: number;
      operations: Record<string, number>;
    }>;
    operationBreakdown?: {
      transcribe: number;
      query: number;
      total: number;
    };
  }>;

  // Enhanced method with additional parameters
  getUsageData?(period?: string): Promise<{
    dailyQueries: number;
    dailyLimit: number;
    dailyRemaining: number;
    monthlyQueries: number;
    monthlyLimit: number;
    monthlyRemaining: number;
    dailyCost: number;
    monthlyCost: number;
    currency: string;
    costBreakdown?: {
      transcribe: number;
      bedrock: number;
      lambda: number;
      s3: number;
      apiGateway: number;
    };
    recentQueries?: Array<{
      timestamp: string;
      operation: string;
      cost: number;
      currency: string;
    }>;
    historicalData?: Array<{
      date: string;
      count: number;
      operations: Record<string, number>;
    }>;
    operationBreakdown?: {
      transcribe: number;
      query: number;
      total: number;
    };
  }>;

  getQuotas?(): Promise<{
    daily: {
      limit: number;
      used: number;
      remaining: number;
      percentUsed: number;
    };
    monthly: {
      limit: number;
      used: number;
      remaining: number;
      percentUsed: number;
    };
    status: string;
    lastOperation?: string;
    lastUpdated?: string;
  }>;
}

export interface QueryService {
  textQuery(query: string, options?: any): Promise<any>;
  voiceQuery(audioInput: { audioUri: string | null }, options?: any): Promise<any>;
}

export interface ManualsService {
  getManuals(): Promise<any[]>;
  uploadManual(file: File): Promise<any>;
  deleteManual(id: string): Promise<void>;
  getManualDetail(id: string): Promise<any>;
  uploadFromUrl?(url: string, customName?: string): Promise<any>;
}
