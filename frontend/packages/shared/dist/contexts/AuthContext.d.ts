import { ReactNode } from 'react';
import { AppState, LoginRequest, SignupRequest } from '../types';
interface AuthContextType {
    state: AppState;
    signIn: (credentials: LoginRequest) => Promise<void>;
    signUp: (userData: SignupRequest) => Promise<{
        needsConfirmation: boolean;
    }>;
    confirmSignUp: (email: string, code: string) => Promise<void>;
    resendConfirmationCode: (email: string) => Promise<void>;
    signOut: () => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
    confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
    refreshTokens: () => Promise<void>;
    clearError: () => void;
}
interface AuthProviderProps {
    children: ReactNode;
}
export declare function AuthProvider({ children }: AuthProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useAuth(): AuthContextType;
export {};
//# sourceMappingURL=AuthContext.d.ts.map
