import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../interfaces';
import { handleApiError } from '../real/errorHandler';

// Cognito configuration (matches the CLI)
const COGNITO_CONFIG = {
  USER_POOL_ID: 'eu-west-1_DQt2MDcmp',
  CLIENT_ID: '3ai5dri6105vaut9bie6ku5omb',
  REGION: 'eu-west-1',
};

export class WebAuthService implements AuthService {
  private userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: COGNITO_CONFIG.USER_POOL_ID,
      ClientId: COGNITO_CONFIG.CLIENT_ID,
    });
  }

  async login(email: string, password: string) {
    try {
      const result = await this.signIn(email, password);

      // Store tokens in AsyncStorage
      await AsyncStorage.setItem('authToken', result.tokens.IdToken);
      await AsyncStorage.setItem('accessToken', result.tokens.AccessToken);
      await AsyncStorage.setItem('refreshToken', result.tokens.RefreshToken);
      await AsyncStorage.setItem('userEmail', email);

      return {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.email.split('@')[0],
          verified: result.user.email_verified,
        },
        token: result.tokens.IdToken,
      };
    } catch (error) {
      throw handleApiError(error, 'login');
    }
  }

  async signup(email: string, password: string, name: string) {
    try {
      const result = await this.signUp(email, password, name);

      return {
        user: {
          id: result.userSub,
          email: email,
          name: name,
          verified: false,
        },
        token: '', // No token until confirmed
      };
    } catch (error) {
      throw handleApiError(error, 'signup');
    }
  }

  async confirmSignup(email: string, code: string) {
    try {
      await this.confirmSignUp(email, code);
    } catch (error) {
      throw handleApiError(error, 'email confirmation');
    }
  }

  async resendConfirmationCode(email: string) {
    try {
      await this.resendConfirmCode(email);
    } catch (error) {
      throw handleApiError(error, 'resend confirmation code');
    }
  }

  async logout() {
    try {
      await this.signOut();
      // Clear stored tokens
      await AsyncStorage.multiRemove(['authToken', 'accessToken', 'refreshToken', 'userEmail']);
    } catch (error) {
      throw handleApiError(error, 'logout');
    }
  }

  async getCurrentUser() {
    try {
      const user = await this.getCognitoUser();
      return user;
    } catch (error) {
      return null;
    }
  }

  async forgotPassword(email: string) {
    try {
      await this.initiateForgotPassword(email);
    } catch (error) {
      throw handleApiError(error, 'forgot password');
    }
  }

  // Private methods that wrap Cognito calls

  private async signUp(email: string, password: string, name: string): Promise<{ userSub: string; needsConfirmation: boolean }> {
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

      this.userPool.signUp(
        email,
        password,
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

  private async confirmSignUp(email: string, code: string): Promise<void> {
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

  private async resendConfirmCode(email: string): Promise<void> {
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

  private async signIn(email: string, password: string): Promise<{ tokens: any; user: any }> {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password,
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: this.userPool,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (session: CognitoUserSession) => {
          const tokens = {
            AccessToken: session.getAccessToken().getJwtToken(),
            IdToken: session.getIdToken().getJwtToken(),
            RefreshToken: session.getRefreshToken().getToken(),
            ExpiresIn: session.getAccessToken().getExpiration(),
          };

          const payload = session.getIdToken().payload;
          const user = {
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
      });
    });
  }

  private async signOut(): Promise<void> {
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

  private async getCognitoUser(): Promise<any | null> {
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
        const user = {
          id: payload.sub,
          email: payload.email,
          email_verified: payload.email_verified || false,
          created_at: new Date(payload.iat * 1000).toISOString(),
        };

        resolve(user);
      });
    });
  }

  private async initiateForgotPassword(email: string): Promise<void> {
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
}
