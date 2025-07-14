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
  uploadFromUrl?(url: string, customName?: string): Promise<any>;
}
