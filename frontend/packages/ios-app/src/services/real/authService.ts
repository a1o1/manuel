import { AuthService } from '../index';
import { authService as sharedAuthService } from '@manuel/shared';
import { handleApiError } from './errorHandler';

export class RealAuthService implements AuthService {
  async login(email: string, password: string) {
    try {
      const response = await sharedAuthService.signIn(email, password);

      // Transform response to match iOS app interface
      const user = {
        id: response.userId || response.sub,
        email: response.email || email,
        name: response.name || response.given_name || email.split('@')[0],
        verified: response.email_verified || true,
      };

      const token = response.idToken || response.AccessToken;

      return { user, token };
    } catch (error) {
      throw handleApiError(error, 'login');
    }
  }

  async signup(email: string, password: string, name: string) {
    try {
      const response = await sharedAuthService.signUp(email, password, name);

      // For signup, user might not be confirmed yet
      const user = {
        id: response.userSub || response.userId,
        email,
        name,
        verified: false, // Will be true after confirmation
      };

      // No token until confirmed
      const token = '';

      return { user, token };
    } catch (error) {
      throw handleApiError(error, 'signup');
    }
  }

  async confirmSignup(email: string, code: string) {
    try {
      await sharedAuthService.confirmSignUp(email, code);
    } catch (error) {
      throw handleApiError(error, 'email confirmation');
    }
  }

  async resendConfirmationCode(email: string) {
    try {
      await sharedAuthService.resendConfirmationCode(email);
    } catch (error) {
      throw handleApiError(error, 'resend confirmation code');
    }
  }

  async logout() {
    try {
      await sharedAuthService.signOut();
    } catch (error) {
      throw handleApiError(error, 'logout');
    }
  }

  async getCurrentUser() {
    try {
      const userInfo = await sharedAuthService.getCurrentUser();

      if (!userInfo) {
        return null;
      }

      // Transform to iOS app format
      return {
        id: userInfo.sub || userInfo.userId,
        email: userInfo.email,
        name: userInfo.name || userInfo.given_name || userInfo.email?.split('@')[0],
        verified: userInfo.email_verified || true,
      };
    } catch (error) {
      // Don't throw for getCurrentUser - return null if not authenticated
      console.log('Not authenticated or session expired');
      return null;
    }
  }

  async forgotPassword(email: string) {
    try {
      await sharedAuthService.forgotPassword(email);
    } catch (error) {
      throw handleApiError(error, 'forgot password');
    }
  }

  // Additional method for password reset confirmation
  async confirmForgotPassword(email: string, code: string, newPassword: string) {
    try {
      await sharedAuthService.confirmForgotPassword(email, code, newPassword);
    } catch (error) {
      throw handleApiError(error, 'password reset');
    }
  }

  // Get current session info
  async getCurrentSession() {
    try {
      return await sharedAuthService.getCurrentSession();
    } catch (error) {
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return user !== null;
    } catch {
      return false;
    }
  }
}
