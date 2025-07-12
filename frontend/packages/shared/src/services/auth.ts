import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
  CognitoRefreshToken,
} from 'amazon-cognito-identity-js';
import { COGNITO_CONFIG } from '../constants';
import { AuthStorage } from '../utils/storage';
import { LoginRequest, SignupRequest, AuthTokens, User } from '../types';

class AuthService {
  private userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.USER_POOL_ID,
      ClientId: COGNITO_CONFIG.CLIENT_ID,
    });
  }

  // Sign up new user
  async signUp(request: SignupRequest): Promise<{ userSub: string; needsConfirmation: boolean }> {
    return new Promise((resolve, reject) => {
      const attributeList: CognitoUserAttribute[] = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: request.email,
        }),
      ];

      this.userPool.signUp(
        request.email,
        request.password,
        attributeList,
        [],
        (err, result) => {
          if (err) {
            reject(new Error(err.message || 'Sign up failed'));
            return;
          }

          if (!result) {
            reject(new Error('Sign up failed'));
            return;
          }

          resolve({
            userSub: result.userSub,
            needsConfirmation: !result.user,
          });
        }
      );
    });
  }

  // Confirm sign up with verification code
  async confirmSignUp(email: string, code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmRegistration(code, true, (err) => {
        if (err) {
          reject(new Error(err.message || 'Confirmation failed'));
          return;
        }
        resolve();
      });
    });
  }

  // Resend confirmation code
  async resendConfirmationCode(email: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.resendConfirmationCode((err) => {
        if (err) {
          reject(new Error(err.message || 'Failed to resend code'));
          return;
        }
        resolve();
      });
    });
  }

  // Sign in user
  async signIn(request: LoginRequest): Promise<{ tokens: AuthTokens; user: User }> {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: request.email,
        Password: request.password,
      });

      const cognitoUser = new CognitoUser({
        Username: request.email,
        Pool: this.userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const tokens: AuthTokens = {
            AccessToken: session.getAccessToken().getJwtToken(),
            IdToken: session.getIdToken().getJwtToken(),
            RefreshToken: session.getRefreshToken().getToken(),
            ExpiresIn: session.getAccessToken().getExpiration(),
          };

          const payload = session.getIdToken().payload;
          const user: User = {
            id: payload.sub,
            email: payload.email,
            email_verified: payload.email_verified || false,
            created_at: new Date(payload.iat * 1000).toISOString(),
          };

          resolve({ tokens, user });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Sign in failed'));
        },
        newPasswordRequired: () => {
          reject(new Error('New password required'));
        },
        mfaRequired: () => {
          reject(new Error('MFA required (not implemented)'));
        },
        totpRequired: () => {
          reject(new Error('TOTP required (not implemented)'));
        },
      });
    });
  }

  // Sign out user
  async signOut(): Promise<void> {
    return new Promise((resolve) => {
      const cognitoUser = this.userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.signOut(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Get current authenticated user
  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        const payload = session.getIdToken().payload;
        const user: User = {
          id: payload.sub,
          email: payload.email,
          email_verified: payload.email_verified || false,
          created_at: new Date(payload.iat * 1000).toISOString(),
        };

        resolve(user);
      });
    });
  }

  // Get current session
  async getCurrentSession(): Promise<CognitoUserSession | null> {
    return new Promise((resolve) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session);
      });
    });
  }

  // Refresh tokens
  async refreshTokens(): Promise<AuthTokens> {
    return new Promise((resolve, reject) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        reject(new Error('No current user'));
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          reject(new Error('Failed to get session'));
          return;
        }

        const refreshToken = session.getRefreshToken();

        cognitoUser.refreshSession(refreshToken, (refreshErr, refreshedSession) => {
          if (refreshErr) {
            reject(new Error(refreshErr.message || 'Token refresh failed'));
            return;
          }

          const tokens: AuthTokens = {
            AccessToken: refreshedSession.getAccessToken().getJwtToken(),
            IdToken: refreshedSession.getIdToken().getJwtToken(),
            RefreshToken: refreshedSession.getRefreshToken().getToken(),
            ExpiresIn: refreshedSession.getAccessToken().getExpiration(),
          };

          resolve(tokens);
        });
      });
    });
  }

  // Forgot password
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
        onFailure: (err) => {
          reject(new Error(err.message || 'Failed to send reset code'));
        },
      });
    });
  }

  // Confirm forgot password
  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.confirmPassword(code, newPassword, {
        onSuccess: () => {
          resolve();
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Failed to reset password'));
        },
      });
    });
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = this.userPool.getCurrentUser();

      if (!cognitoUser) {
        reject(new Error('No current user'));
        return;
      }

      cognitoUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          reject(new Error('Invalid session'));
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
          if (changeErr) {
            reject(new Error(changeErr.message || 'Failed to change password'));
            return;
          }
          resolve();
        });
      });
    });
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getCurrentSession();
      return session !== null && session.isValid();
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
