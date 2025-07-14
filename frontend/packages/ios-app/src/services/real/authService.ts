// Real authentication service - AWS Cognito integration with SRP
import '../../utils/crypto-polyfill'; // Must be imported before Cognito SDK
import { AuthService } from '../interfaces';
import { ENV_CONFIG } from '../../config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';

interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface CognitoUser {
  sub: string;
  email: string;
  name?: string;
  email_verified: boolean;
}

export class RealAuthService implements AuthService {
  private readonly cognitoConfig = ENV_CONFIG.COGNITO;
  private readonly storageKey = '@manuel/auth_tokens';
  private readonly userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: this.cognitoConfig.USER_POOL_ID,
      ClientId: this.cognitoConfig.CLIENT_ID,
    });
  }

  private async storeTokens(tokens: CognitoTokens): Promise<void> {
    try {
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store auth tokens:', error);
      throw new Error('Failed to save authentication session');
    }
  }

  private async getStoredTokens(): Promise<CognitoTokens | null> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to retrieve auth tokens:', error);
      return null;
    }
  }

  private async clearStoredTokens(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error('Failed to clear auth tokens:', error);
    }
  }

  private parseJwtPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to parse JWT:', error);
      return null;
    }
  }

  private async refreshTokens(refreshToken: string): Promise<CognitoTokens> {
    return new Promise((resolve, reject) => {
      const currentUser = this.userPool.getCurrentUser();
      if (!currentUser) {
        reject(new Error('No current user found'));
        return;
      }

      currentUser.getSession((err: any, session: CognitoUserSession) => {
        if (err) {
          reject(err);
          return;
        }

        if (!session.isValid()) {
          reject(new Error('Session is not valid'));
          return;
        }

        const tokens: CognitoTokens = {
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          expiresAt: session.getIdToken().getExpiration() * 1000,
        };

        resolve(tokens);
      });
    });
  }

  private async ensureValidTokens(): Promise<CognitoTokens | null> {
    const stored = await this.getStoredTokens();
    if (!stored) return null;

    // Check if token is still valid (with 5 minute buffer)
    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 minutes

    if (stored.expiresAt > now + buffer) {
      return stored; // Token is still valid
    }

    // Try to refresh tokens
    try {
      const refreshed = await this.refreshTokens(stored.refreshToken);
      await this.storeTokens(refreshed);
      return refreshed;
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.clearStoredTokens();
      return null;
    }
  }

  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async (session: CognitoUserSession) => {
          try {
            const tokens: CognitoTokens = {
              idToken: session.getIdToken().getJwtToken(),
              accessToken: session.getAccessToken().getJwtToken(),
              refreshToken: session.getRefreshToken().getToken(),
              expiresAt: session.getIdToken().getExpiration() * 1000,
            };

            await this.storeTokens(tokens);

            const idTokenPayload = session.getIdToken().payload;
            const user: CognitoUser = {
              sub: idTokenPayload.sub,
              email: idTokenPayload.email,
              name: idTokenPayload.name || idTokenPayload.given_name,
              email_verified: idTokenPayload.email_verified === true,
            };

            resolve({
              user,
              token: tokens.idToken,
            });
          } catch (error) {
            console.error('Token storage failed:', error);
            reject(new Error('Failed to save authentication session'));
          }
        },
        onFailure: (error: any) => {
          console.error('Login failed:', error);

          // Create a new error that preserves the original error structure
          // This allows the UI error handler to access the error code
          const enhancedError = new Error(error.message || 'Login failed');
          (enhancedError as any).code = error.code;
          (enhancedError as any).name = error.name;
          (enhancedError as any).originalError = error;

          reject(enhancedError);
        },
        newPasswordRequired: () => {
          reject(new Error('New password required. Please contact support'));
        },
        mfaRequired: () => {
          reject(new Error('MFA not supported in this version'));
        },
      });
    });
  }

  async signup(email: string, password: string, name: string): Promise<{ user: any; token: string }> {
    return new Promise((resolve, reject) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
        new CognitoUserAttribute({
          Name: 'name',
          Value: name,
        }),
      ];

      this.userPool.signUp(email, password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Signup failed:', err);

          // Create a new error that preserves the original error structure
          const enhancedError = new Error(err.message || 'Signup failed');
          (enhancedError as any).code = err.code;
          (enhancedError as any).name = err.name;
          (enhancedError as any).originalError = err;

          reject(enhancedError);
          return;
        }

        if (result) {
          // For signup, we don't get tokens immediately - user needs to confirm account
          const user = {
            sub: result.userSub,
            email: email,
            name: name,
            email_verified: false,
          };

          resolve({
            user,
            token: '', // No token until account is confirmed
          });
        } else {
          reject(new Error('Signup failed - no result returned'));
        }
      });
    });
  }

  async confirmSignup(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          console.error('Confirmation failed:', err);

          const enhancedError = new Error(err.message || 'Account confirmation failed');
          (enhancedError as any).code = err.code;
          (enhancedError as any).name = err.name;
          (enhancedError as any).originalError = err;

          reject(enhancedError);
          return;
        }

        resolve();
      });
    });
  }

  async resendConfirmationCode(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          console.error('Resend confirmation failed:', err);
          const enhancedError = new Error(err.message || 'Failed to resend confirmation code');
          (enhancedError as any).code = err.code;
          (enhancedError as any).name = err.name;
          (enhancedError as any).originalError = err;
          reject(enhancedError);
          return;
        }

        resolve();
      });
    });
  }

  async logout(): Promise<void> {
    try {
      // Try to get the current user and sign them out
      const currentUser = this.userPool.getCurrentUser();
      if (currentUser) {
        currentUser.signOut();
      }
    } catch (error) {
      console.warn('Failed to sign out from Cognito:', error);
      // Continue with local logout even if server logout fails
    } finally {
      // Always clear local tokens
      await this.clearStoredTokens();
    }
  }

  async forgotPassword(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.forgotPassword({
        onSuccess: () => {
          resolve();
        },
        onFailure: (err: any) => {
          console.error('Forgot password failed:', err);

          const enhancedError = new Error(err.message || 'Failed to send password reset email');
          (enhancedError as any).code = err.code;
          (enhancedError as any).name = err.name;
          (enhancedError as any).originalError = err;

          reject(enhancedError);
        },
      });
    });
  }

  async getCurrentUser(): Promise<CognitoUser | null> {
    try {
      const tokens = await this.ensureValidTokens();
      if (!tokens) {
        // Try to get user from Cognito's local storage
        const currentUser = this.userPool.getCurrentUser();
        if (!currentUser) return null;

        // Try to get a session to verify the user is still valid
        return new Promise((resolve) => {
          currentUser.getSession((err: any, session: CognitoUserSession) => {
            if (err || !session.isValid()) {
              resolve(null);
              return;
            }

            const idTokenPayload = session.getIdToken().payload;
            resolve({
              sub: idTokenPayload.sub,
              email: idTokenPayload.email,
              name: idTokenPayload.name || idTokenPayload.given_name,
              email_verified: idTokenPayload.email_verified === true,
            });
          });
        });
      }

      const payload = this.parseJwtPayload(tokens.idToken);
      if (!payload) return null;

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name || payload.given_name,
        email_verified: payload.email_verified === true,
      };
    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  // Additional helper method to get the current auth token for API calls
  async getAuthToken(): Promise<string | null> {
    const tokens = await this.ensureValidTokens();
    return tokens?.idToken || null;
  }

  // Helper method to check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }
}
