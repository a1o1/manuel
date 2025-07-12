import { AuthService } from '../index';

export class MockAuthService implements AuthService {
  private currentUser: any = null;

  async login(email: string, password: string) {
    // Simulate API delay
    await this.delay(1500);

    const user = {
      id: '1',
      email,
      name: email.split('@')[0],
    };

    const token = 'mock-jwt-token';
    this.currentUser = user;

    return { user, token };
  }

  async signup(email: string, password: string, name: string) {
    await this.delay(1500);

    const user = {
      id: '1',
      email,
      name,
    };

    const token = 'mock-jwt-token';
    this.currentUser = user;

    return { user, token };
  }

  async logout() {
    await this.delay(500);
    this.currentUser = null;
  }

  async getCurrentUser() {
    await this.delay(200);
    return this.currentUser;
  }

  async forgotPassword(email: string) {
    await this.delay(1000);
    // Mock implementation - in real app would send email
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
