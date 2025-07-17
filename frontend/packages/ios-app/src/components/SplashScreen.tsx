import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { graphicsService } from '../services/graphicsService';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  isLoading: boolean;
  loadingText?: string;
  onLoadingComplete?: () => void;
}

export function SplashScreen({
  isLoading,
  loadingText = "Loading...",
  onLoadingComplete
}: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const colors = graphicsService.getColorPalette();

  useEffect(() => {
    if (isLoading) {
      // Start entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Start pulsing animation
      startPulseAnimation();
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onLoadingComplete?.();
      });
    }
  }, [isLoading]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  if (!isLoading && fadeAnim._value === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={colors.gradients.primaryBlue}
        style={styles.gradient}
      >
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Manuel Character */}
          <Animated.View
            style={[
              styles.characterContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <View style={styles.characterPlaceholder}>
              <Text style={styles.characterEmoji}>👨‍🍳</Text>
            </View>
          </Animated.View>

          {/* App Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Manuel</Text>
            <Text style={styles.subtitle}>Voice Assistant for Product Manuals</Text>
          </View>

          {/* Loading Indicator */}
          <View style={styles.loadingContainer}>
            <View style={styles.loadingDots}>
              <AnimatedDot delay={0} />
              <AnimatedDot delay={200} />
              <AnimatedDot delay={400} />
            </View>
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

function AnimatedDot({ delay }: { delay: number }) {
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animate();
  }, [delay]);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: dotAnim,
          transform: [
            {
              scale: dotAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.2],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterContainer: {
    marginBottom: 40,
  },
  characterPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  characterEmoji: {
    fontSize: 48,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'System',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
});

// Export different variations
export function AppLoadingSplash() {
  return (
    <SplashScreen
      isLoading={true}
      loadingText="Initializing Manuel..."
    />
  );
}

export function AuthLoadingSplash() {
  return (
    <SplashScreen
      isLoading={true}
      loadingText="Authenticating..."
    />
  );
}

export function DataLoadingSplash() {
  return (
    <SplashScreen
      isLoading={true}
      loadingText="Loading your data..."
    />
  );
}
