import { CognitoUserSession } from 'amazon-cognito-identity-js';
import { LoginRequest, SignupRequest, AuthTokens, User } from '../types';
declare class AuthService {
    private userPool;
    constructor();
    signUp(request: SignupRequest): Promise<{
        userSub: string;
        needsConfirmation: boolean;
    }>;
    confirmSignUp(email: string, code: string): Promise<void>;
    resendConfirmationCode(email: string): Promise<void>;
    signIn(request: LoginRequest): Promise<{
        tokens: AuthTokens;
        user: User;
    }>;
    signOut(): Promise<void>;
    getCurrentUser(): Promise<User | null>;
    getCurrentSession(): Promise<CognitoUserSession | null>;
    refreshTokens(): Promise<AuthTokens>;
    forgotPassword(email: string): Promise<void>;
    confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void>;
    changePassword(oldPassword: string, newPassword: string): Promise<void>;
    isAuthenticated(): Promise<boolean>;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.d.ts.map