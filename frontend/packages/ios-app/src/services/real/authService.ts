// Real authentication service - pure implementation without Amplify
import { AuthService } from '../interfaces';

export class RealAuthService implements AuthService {
  async login(email: string, password: string) {
    throw new Error('Real authentication not implemented - use mock mode');
  }

  async signup(email: string, password: string, name: string) {
    throw new Error('Real authentication not implemented - use mock mode');
  }

  async logout() {
    // No-op for now
  }

  async forgotPassword(email: string) {
    throw new Error('Real authentication not implemented - use mock mode');
  }

  async getCurrentUser() {
    return null;
  }
}