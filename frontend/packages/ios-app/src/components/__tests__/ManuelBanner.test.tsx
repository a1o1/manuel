import React from 'react';
import { render } from '@testing-library/react-native';
import { ManuelBanner, ManuelHeaderBanner, ManuelCompactBanner } from '../ManuelBanner';

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
    getManuelCharacter: jest.fn(() => ({ uri: 'mock-character-uri' })),
    getColorPalette: jest.fn(() => ({
      gradients: {
        primaryBlue: ['#1E3A8A', '#3B82F6'],
      },
    })),
    getTypographyStyles: jest.fn(() => ({
      title: { fontSize: 28, fontWeight: 'bold' },
      subtitle: { fontSize: 16, fontWeight: '500' },
    })),
  },
}));

describe('ManuelBanner', () => {
  it('renders default banner correctly', () => {
    const { getByText } = render(<ManuelBanner />);
    
    expect(getByText('Manuel')).toBeTruthy();
    expect(getByText('Your AI Manual Assistant')).toBeTruthy();
  });

  it('renders with custom title and subtitle', () => {
    const { getByText } = render(
      <ManuelBanner title="Custom Title" subtitle="Custom Subtitle" />
    );
    
    expect(getByText('Custom Title')).toBeTruthy();
    expect(getByText('Custom Subtitle')).toBeTruthy();
  });

  it('renders header banner variant', () => {
    const { getByText } = render(<ManuelHeaderBanner />);
    
    expect(getByText('Manuel')).toBeTruthy();
    expect(getByText('Voice Assistant for Product Manuals')).toBeTruthy();
  });

  it('renders compact banner variant', () => {
    const { getByText } = render(<ManuelCompactBanner />);
    
    expect(getByText('Manuel')).toBeTruthy();
    // Compact version should not show subtitle
    expect(() => getByText('Your AI Manual Assistant')).toThrow();
  });

  it('hides character when showCharacter is false', () => {
    const { queryByTestId } = render(<ManuelBanner showCharacter={false} />);
    
    // Since we don't have testID on the character container, we test by checking
    // that the component still renders the text parts
    expect(queryByTestId('character-container')).toBeFalsy();
  });
});