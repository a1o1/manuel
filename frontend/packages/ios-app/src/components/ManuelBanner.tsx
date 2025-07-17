import React from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { graphicsService } from '../services/graphicsService';

const { width: screenWidth } = Dimensions.get('window');

interface ManuelBannerProps {
  title?: string;
  subtitle?: string;
  showCharacter?: boolean;
  compact?: boolean;
}

export function ManuelBanner({
  title = "Manuel",
  subtitle = "Your AI Manual Assistant",
  showCharacter = true,
  compact = false
}: ManuelBannerProps) {
  const insets = useSafeAreaInsets();
  const bannerHeight = compact ? 44 : 60;
  const totalHeight = bannerHeight + insets.top;
  const colors = graphicsService.getColorPalette();
  const typography = graphicsService.getTypographyStyles();

  return (
    <LinearGradient
      colors={colors.gradients.primaryBlue}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.container, { height: totalHeight, paddingTop: insets.top }]}
    >
      <View style={styles.content}>
        {showCharacter && (
          <View style={styles.characterContainer}>
            {/* Manuel character image - will be replaced with AI-generated graphics */}
            <Image
              source={graphicsService.getManuelCharacter(compact ? 'compact' : 'default')}
              style={[styles.characterImage, compact && styles.characterImageCompact]}
              defaultSource={{ uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }}
            />
            {/* Fallback placeholder */}
            <View style={[styles.characterPlaceholder, compact && styles.characterPlaceholderCompact]}>
              <Text style={styles.characterEmoji}>👨‍🍳</Text>
            </View>
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
          {!compact && subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>

        <View style={styles.decorationContainer}>
          {/* Floating book/manual decoration */}
          <View style={styles.bookDecoration}>
            <Text style={styles.bookEmoji}>📖</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  characterContainer: {
    marginRight: 15,
  },
  characterImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  characterImageCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  characterPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'absolute',
  },
  characterPlaceholderCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  characterEmoji: {
    fontSize: 20,
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
  titleCompact: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
    fontWeight: '500',
  },
  decorationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookDecoration: {
    opacity: 0.6,
    transform: [{ rotate: '15deg' }],
  },
  bookEmoji: {
    fontSize: 20,
    color: '#F59E0B',
  },
});

// Export additional banner variants
export function ManuelHeaderBanner() {
  return (
    <ManuelBanner
      title="Manuel"
      subtitle="Voice Assistant for Product Manuals"
      showCharacter={true}
      compact={false}
    />
  );
}

export function ManuelCompactBanner() {
  return (
    <ManuelBanner
      title="Manuel"
      showCharacter={true}
      compact={true}
    />
  );
}

export function ManuelTextOnlyBanner({ title }: { title?: string }) {
  return (
    <ManuelBanner
      title={title || "Manuel"}
      showCharacter={false}
      compact={true}
    />
  );
}
