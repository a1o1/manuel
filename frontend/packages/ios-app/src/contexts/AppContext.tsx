import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService, usageService } from '../services';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Usage {
  dailyQueries: number;
  dailyLimit: number;
  dailyRemaining: number;
  dailyCost: number;
  monthlyQueries: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  monthlyCost: number;
}

interface AppContextType {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;

  // Usage state
  usage: Usage | null;
  isUsageLoading: boolean;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  confirmSignup: (email: string, code: string) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;

  // Usage actions
  refreshUsage: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Usage state
  const [usage, setUsage] = useState<Usage | null>(null);
  const [isUsageLoading, setIsUsageLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.log('No authenticated user');
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuthState();
  }, []);

  // Load usage when user changes
  useEffect(() => {
    if (user) {
      loadUsage();
    } else {
      setUsage(null);
      setIsUsageLoading(false);
    }
  }, [user]);

  const loadUsage = async () => {
    setIsUsageLoading(true);
    try {
      const usageData = await usageService.getUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to load usage:', error);
    } finally {
      setIsUsageLoading(false);
    }
  };

  // Auth actions
  const login = async (email: string, password: string) => {
    setIsAuthLoading(true);
    try {
      const { user: loggedInUser } = await authService.login(email, password);
      setUser(loggedInUser);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signup = async (email: string, password: string, firstName: string, lastName?: string) => {
    setIsAuthLoading(true);
    try {
      // Combine first and last name like the CLI does
      const fullName = lastName ? `${firstName} ${lastName}` : firstName;
      const { user: newUser } = await authService.signup(email, password, fullName);
      setUser(newUser);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const confirmSignup = async (email: string, code: string) => {
    await authService.confirmSignup(email, code);
  };

  const resendConfirmationCode = async (email: string) => {
    await authService.resendConfirmationCode(email);
  };

  const logout = async () => {
    setIsAuthLoading(true);
    try {
      await authService.logout();
      setUser(null);
      setUsage(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const forgotPassword = async (email: string) => {
    await authService.forgotPassword(email);
  };

  const refreshUsage = async () => {
    if (!user) return;

    setIsUsageLoading(true);
    try {
      const usageData = await usageService.refreshUsage();
      setUsage(usageData);
    } catch (error) {
      console.error('Failed to refresh usage:', error);
    } finally {
      setIsUsageLoading(false);
    }
  };

  const value: AppContextType = {
    // Auth state
    user,
    isAuthenticated: !!user,
    isAuthLoading,

    // Usage state
    usage,
    isUsageLoading,

    // Auth actions
    login,
    signup,
    confirmSignup,
    resendConfirmationCode,
    logout,
    forgotPassword,

    // Usage actions
    refreshUsage,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Backwards compatibility exports
export const useAuth = () => {
  const { user, isAuthenticated, isAuthLoading, login, signup, confirmSignup, resendConfirmationCode, logout, forgotPassword } = useApp();
  return {
    user,
    isAuthenticated,
    isLoading: isAuthLoading,
    login,
    signup,
    confirmSignup,
    resendConfirmationCode,
    logout,
    forgotPassword
  };
};

export const useUsage = () => {
  const { usage, isUsageLoading, refreshUsage } = useApp();
  return {
    usage,
    isLoading: isUsageLoading,
    refreshUsage
  };
};
