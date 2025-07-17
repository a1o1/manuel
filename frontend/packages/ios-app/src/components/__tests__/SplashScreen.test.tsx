import React from 'react';
import { render } from '@testing-library/react-native';
import { SplashScreen, AppLoadingSplash, AuthLoadingSplash } from '../SplashScreen';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

// Mock graphics service
jest.mock('../../services/graphicsService', () => ({
  graphicsService: {
    getColorPalette: jest.fn(() => ({
      gradients: {
        primaryBlue: ['#1E3A8A', '#3B82F6'],
      },
    })),
  },
}));

describe('SplashScreen', () => {
  it('renders loading screen with default text', () => {
    const { getByText } = render(
      <SplashScreen isLoading={true} />
    );

    expect(getByText('Loading...')).toBeTruthy();
  });

  it('renders loading screen with custom text', () => {
    const { getByText } = render(
      <SplashScreen isLoading={true} loadingText="Custom loading text" />
    );

    expect(getByText('Custom loading text')).toBeTruthy();
  });

  it('renders app loading splash variant', () => {
    const { getByText } = render(<AppLoadingSplash />);

    expect(getByText('Initializing Manuel...')).toBeTruthy();
  });

  it('renders auth loading splash variant', () => {
    const { getByText } = render(<AuthLoadingSplash />);

    expect(getByText('Authenticating...')).toBeTruthy();
  });

  it('shows Manuel branding elements', () => {
    const { getByText } = render(
      <SplashScreen isLoading={true} />
    );

    expect(getByText('Manuel')).toBeTruthy();
    expect(getByText('Voice Assistant for Product Manuals')).toBeTruthy();
  });

  it('hides when isLoading is false', () => {
    const { queryByText } = render(
      <SplashScreen isLoading={false} />
    );

    // Should not render the loading text when not loading
    expect(queryByText('Loading...')).toBeFalsy();
  });
});
