import { AuthService } from '../index';
import { mockUserContext } from './userContext';

export class MockAuthService implements AuthService {
  private currentUser: any = null;

  async login(email: string, password: string) {
    // Simulate API delay
    await this.delay(1500);

    // Map emails to different user IDs for testing user isolation
    const userId = this.getUserIdFromEmail(email);
    
    const user = {
      id: userId,
      email,
      name: this.getNameFromEmail(email),
    };

    const token = 'mock-jwt-token';
    this.currentUser = user;
    
    // Update mock user context
    mockUserContext.setCurrentUserId(userId);

    return { user, token };
  }

  async signup(email: string, password: string, name: string) {
    await this.delay(1500);

    const userId = this.getUserIdFromEmail(email);

    const user = {
      id: userId,
      email,
      name,
    };

    const token = 'mock-jwt-token';
    this.currentUser = user;
    
    // Update mock user context
    mockUserContext.setCurrentUserId(userId);

    return { user, token };
  }

  async logout() {
    await this.delay(500);
    this.currentUser = null;
    // Reset to default user
    mockUserContext.setCurrentUserId('user1');
  }

  async getCurrentUser() {
    await this.delay(200);
    return this.currentUser;
  }

  private getUserIdFromEmail(email: string): string {
    // Map specific emails to user IDs for testing
    const emailToUserId: Record<string, string> = {
      'john.doe@example.com': 'user1',
      'jane.smith@example.com': 'user2', 
      'mike.johnson@example.com': 'user3',
    };
    
    return emailToUserId[email] || 'user1';
  }

  private getNameFromEmail(email: string): string {
    const emailToName: Record<string, string> = {
      'john.doe@example.com': 'John Doe',
      'jane.smith@example.com': 'Jane Smith',
      'mike.johnson@example.com': 'Mike Johnson',
    };
    
    return emailToName[email] || email.split('@')[0];
  }

  async confirmSignup(email: string, code: string) {
    await this.delay(1000);
    
    // Mock validation - accept any 6-digit code
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      throw new Error('Invalid verification code provided');
    }
    
    // Mock success - in real app would verify with Cognito
  }

  async resendConfirmationCode(email: string) {
    await this.delay(1000);
    // Mock implementation - in real app would resend via Cognito
  }

  async forgotPassword(email: string) {
    await this.delay(1000);
    // Mock implementation - in real app would send email
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
