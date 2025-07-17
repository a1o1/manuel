import { Image, ImageSourcePropType } from 'react-native';
import { Asset } from 'expo-asset';

/**
 * Graphics service for managing Manuel app graphics assets
 */
export class GraphicsService {
  private static instance: GraphicsService;
  private loadedAssets: Map<string, ImageSourcePropType> = new Map();

  private constructor() {}

  public static getInstance(): GraphicsService {
    if (!GraphicsService.instance) {
      GraphicsService.instance = new GraphicsService();
    }
    return GraphicsService.instance;
  }

  /**
   * Get the appropriate Manuel character image based on context
   */
  public getManuelCharacter(variant: 'default' | 'compact' | 'icon' = 'default'): ImageSourcePropType {
    const key = `manuel-character-${variant}`;

    if (this.loadedAssets.has(key)) {
      return this.loadedAssets.get(key)!;
    }

    // Use actual Manuel character images
    let imageSource: ImageSourcePropType;

    switch (variant) {
      case 'default':
        imageSource = require('../assets/images/character/manuel-face-50x50.png');
        break;
      case 'compact':
        imageSource = require('../assets/images/character/manuel-face-36x36.png');
        break;
      case 'icon':
        imageSource = require('../assets/images/character/manuel-180x180.png');
        break;
      default:
        imageSource = require('../assets/images/character/manuel-face-50x50.png');
    }

    this.loadedAssets.set(key, imageSource);
    return imageSource;
  }

  /**
   * Get banner image for app headers
   */
  public getBanner(variant: 'full' | 'compact' = 'full'): ImageSourcePropType {
    const key = `manuel-banner-${variant}`;

    if (this.loadedAssets.has(key)) {
      return this.loadedAssets.get(key)!;
    }

    // Placeholder until AI-generated images are ready
    // TODO: Replace with actual AI-generated banner images
    const placeholderSource = { uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' };

    this.loadedAssets.set(key, placeholderSource);
    return placeholderSource;
  }

  /**
   * Get splash/hero image for auth screens
   */
  public getSplashImage(): ImageSourcePropType {
    const key = 'manuel-splash';

    if (this.loadedAssets.has(key)) {
      return this.loadedAssets.get(key)!;
    }

    const imageSource = require('../assets/images/character/manuel-256x256.png');
    this.loadedAssets.set(key, imageSource);
    return imageSource;
  }

  /**
   * Get app icon image
   */
  public getAppIcon(size: number = 180): ImageSourcePropType {
    const key = `manuel-icon-${size}`;

    if (this.loadedAssets.has(key)) {
      return this.loadedAssets.get(key)!;
    }

    // Use actual Manuel character images based on size
    let imageSource: ImageSourcePropType;

    if (size <= 120) {
      imageSource = require('../assets/images/character/manuel-120x120.png');
    } else if (size <= 180) {
      imageSource = require('../assets/images/character/manuel-180x180.png');
    } else {
      imageSource = require('../assets/images/character/manuel-256x256.png');
    }

    this.loadedAssets.set(key, imageSource);
    return imageSource;
  }

  /**
   * Preload all graphics assets
   */
  public async preloadAssets(): Promise<void> {
    try {
      console.log('Graphics assets preloading...');

      // Preload Manuel character images
      const assets = [
        require('../assets/images/character/manuel-face-50x50.png'),
        require('../assets/images/character/manuel-face-36x36.png'),
        require('../assets/images/character/manuel-180x180.png'),
        require('../assets/images/character/manuel-120x120.png'),
        require('../assets/images/character/manuel-256x256.png'),
      ];

      await Promise.all(assets.map(asset => Asset.loadAsync(asset)));
      console.log('Graphics assets preloaded successfully');
    } catch (error) {
      console.error('Failed to preload graphics assets:', error);
    }
  }

  /**
   * Get color palette for Manuel branding
   */
  public getColorPalette() {
    return {
      primary: {
        manuelBlue: '#1E3A8A',
        manuelOrange: '#F59E0B',
        manuelCream: '#FEF3C7',
      },
      secondary: {
        backgroundGray: '#F3F4F6',
        textDark: '#1F2937',
        textLight: '#6B7280',
      },
      gradients: {
        primaryBlue: ['#1E3A8A', '#3B82F6'],
        warmOrange: ['#F59E0B', '#FBBF24'],
        subtle: ['#F3F4F6', '#E5E7EB'],
      },
    };
  }

  /**
   * Get typography styles for Manuel branding
   */
  public getTypographyStyles() {
    return {
      title: {
        fontFamily: 'System',
        fontSize: 28,
        fontWeight: 'bold' as const,
        letterSpacing: -0.5,
        color: '#1F2937',
      },
      subtitle: {
        fontFamily: 'System',
        fontSize: 16,
        fontWeight: '500' as const,
        color: '#6B7280',
      },
      body: {
        fontFamily: 'System',
        fontSize: 14,
        fontWeight: '400' as const,
        color: '#1F2937',
        lineHeight: 20,
      },
      caption: {
        fontFamily: 'System',
        fontSize: 12,
        fontWeight: '400' as const,
        color: '#6B7280',
      },
    };
  }

  /**
   * Clear cached assets (useful for development)
   */
  public clearCache(): void {
    this.loadedAssets.clear();
    console.log('Graphics cache cleared');
  }
}

// Export singleton instance
export const graphicsService = GraphicsService.getInstance();

// Export types for type safety
export type ManuelCharacterVariant = 'default' | 'compact' | 'icon';
export type ManuelBannerVariant = 'full' | 'compact';
export type ManuelColorPalette = ReturnType<typeof GraphicsService.prototype.getColorPalette>;
export type ManuelTypographyStyles = ReturnType<typeof GraphicsService.prototype.getTypographyStyles>;
