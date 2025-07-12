import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { authService } from '../services';
import { AuthStorage, UserStorage } from '../utils/storage';
import { AppState, User, LoginRequest, SignupRequest } from '../types';

// Action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_TOKENS'; payload: { accessToken: string; refreshToken: string; idToken: string } | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: AppState = {
  isAuthenticated: false,
  user: null,
  tokens: {
    accessToken: null,
    refreshToken: null,
    idToken: null,
  },
  isLoading: true,
  error: null,
};

// Reducer
function authReducer(state: AppState, action: AuthAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_TOKENS':
      return {
        ...state,
        tokens: action.payload || { accessToken: null, refreshToken: null, idToken: null },
      };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'RESET_STATE':
      return { ...initialState, isLoading: false };
    default:
      return state;
  }
}

// Context type
interface AuthContextType {
  state: AppState;
  signIn: (credentials: LoginRequest) => Promise<void>;
  signUp: (userData: SignupRequest) => Promise<{ needsConfirmation: boolean }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  refreshTokens: () => Promise<void>;
  clearError: () => void;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      // Check for stored tokens
      const tokens = await AuthStorage.getTokens();
      if (tokens) {
        dispatch({ type: 'SET_TOKENS', payload: tokens });

        // Check if user is still authenticated
        const isAuthenticated = await authService.isAuthenticated();
        if (isAuthenticated) {
          const user = await authService.getCurrentUser();
          if (user) {
            dispatch({ type: 'SET_USER', payload: user });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
          }
        } else {
          // Tokens are expired/invalid, clear them
          await clearAuthData();
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      await clearAuthData();
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const clearAuthData = async () => {
    await AuthStorage.removeTokens();
    await UserStorage.removeUser();
    dispatch({ type: 'RESET_STATE' });
  };

  const signIn = async (credentials: LoginRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const { tokens, user } = await authService.signIn(credentials);

      // Store tokens securely
      await AuthStorage.storeTokens({
        accessToken: tokens.AccessToken,
        refreshToken: tokens.RefreshToken,
        idToken: tokens.IdToken,
      });

      // Store user data
      await UserStorage.storeUser(user);

      // Update state
      dispatch({ type: 'SET_TOKENS', payload: {
        accessToken: tokens.AccessToken,
        refreshToken: tokens.RefreshToken,
        idToken: tokens.IdToken,
      }});
      dispatch({ type: 'SET_USER', payload: user });
      dispatch({ type: 'SET_AUTHENTICATED', payload: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signUp = async (userData: SignupRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const result = await authService.signUp(userData);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await authService.confirmSignUp(email, code);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Confirmation failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const resendConfirmationCode = async (email: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await authService.resendConfirmationCode(email);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const signOut = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      await authService.signOut();
      await clearAuthData();
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if sign out fails, clear local data
      await clearAuthData();
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await authService.forgotPassword(email);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset code';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const confirmForgotPassword = async (email: string, code: string, newPassword: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await authService.confirmForgotPassword(email, code, newPassword);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await authService.changePassword(oldPassword, newPassword);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password change failed';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const refreshTokens = async () => {
    try {
      const newTokens = await authService.refreshTokens();

      await AuthStorage.storeTokens({
        accessToken: newTokens.AccessToken,
        refreshToken: newTokens.RefreshToken,
        idToken: newTokens.IdToken,
      });

      dispatch({ type: 'SET_TOKENS', payload: {
        accessToken: newTokens.AccessToken,
        refreshToken: newTokens.RefreshToken,
        idToken: newTokens.IdToken,
      }});
    } catch (error) {
      console.error('Token refresh failed:', error);
      await clearAuthData();
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  const value: AuthContextType = {
    state,
    signIn,
    signUp,
    confirmSignUp,
    resendConfirmationCode,
    signOut,
    forgotPassword,
    confirmForgotPassword,
    changePassword,
    refreshTokens,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
