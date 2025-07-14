import React from 'react';
import { render } from '@testing-library/react-native';
import App from './App';

// Mock AsyncStorage for tests
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock navigation dependencies
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: ({ children }: { children: React.ReactNode }) => children,
  }),
}));

// Mock services
jest.mock('./services', () => ({
  authService: {
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn().mockResolvedValue(false),
  },
}));

describe('App', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<App />);
    // This test just ensures the app can render without throwing errors
    expect(getByText).toBeDefined();
  });
});

// Test authentication service interface
describe('RealAuthService', () => {
  it('should have correct interface', async () => {
    const { RealAuthService } = await import('./services/real/authService');
    const authService = new RealAuthService();

    // Verify all required methods exist
    expect(typeof authService.login).toBe('function');
    expect(typeof authService.signup).toBe('function');
    expect(typeof authService.confirmSignup).toBe('function');
    expect(typeof authService.resendConfirmationCode).toBe('function');
    expect(typeof authService.logout).toBe('function');
    expect(typeof authService.getCurrentUser).toBe('function');
    expect(typeof authService.forgotPassword).toBe('function');

    // Verify additional helper methods
    expect(typeof authService.getAuthToken).toBe('function');
    expect(typeof authService.isAuthenticated).toBe('function');
  });
});
