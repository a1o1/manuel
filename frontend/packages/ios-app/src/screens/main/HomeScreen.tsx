import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUsage } from '@manuel/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type HomeScreenNavigationProp = NativeStackNavigationProp<MainStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { user } = useAuth();
  const { usage, isLoading } = useUsage();

  const quickActions = [
    {
      title: 'Ask a Question',
      subtitle: 'Type your question',
      icon: 'chatbubble-outline' as const,
      color: '#007AFF',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Query' }),
    },
    {
      title: 'Voice Query',
      subtitle: 'Speak your question',
      icon: 'mic-outline' as const,
      color: '#34C759',
      onPress: () => navigation.navigate('VoiceQuery'),
    },
    {
      title: 'Browse Manuals',
      subtitle: 'View all manuals',
      icon: 'library-outline' as const,
      color: '#FF9500',
      onPress: () => navigation.navigate('MainTabs', { screen: 'Manuals' }),
    },
    {
      title: 'Usage Stats',
      subtitle: 'View your usage',
      icon: 'analytics-outline' as const,
      color: '#5856D6',
      onPress: () => navigation.navigate('Usage'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hello{user?.firstName ? `, ${user.firstName}` : ''}!
            </Text>
            <Text style={styles.subtitle}>How can Manuel help you today?</Text>
          </View>
        </View>

        {!isLoading && usage && (
          <View style={styles.usageCard}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageTitle}>Today's Usage</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Usage')}>
                <Text style={styles.viewMoreLink}>View Details</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.usageStats}>
              <View style={styles.usageStat}>
                <Text style={styles.usageNumber}>{usage.dailyQueries}</Text>
                <Text style={styles.usageLabel}>Queries</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageStat}>
                <Text style={styles.usageNumber}>{usage.dailyRemaining}</Text>
                <Text style={styles.usageLabel}>Remaining</Text>
              </View>
              <View style={styles.usageDivider} />
              <View style={styles.usageStat}>
                <Text style={styles.usageNumber}>${usage.dailyCost?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.usageLabel}>Cost</Text>
              </View>
            </View>

            {usage.dailyQueries > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min((usage.dailyQueries / usage.dailyLimit) * 100, 100)}%` }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {usage.dailyQueries} of {usage.dailyLimit} queries used
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={action.onPress}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <View style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <Ionicons name="bulb-outline" size={20} color="#FF9500" />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Get Better Answers</Text>
              <Text style={styles.tipText}>
                Be specific with your questions. Instead of "How do I set this up?",
                try "How do I connect the WiFi on my router?"
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  usageCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  usageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  viewMoreLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  usageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  usageStat: {
    alignItems: 'center',
  },
  usageNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  usageLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  usageDivider: {
    width: 1,
    backgroundColor: '#D1D1D6',
    marginHorizontal: 16,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  tipsContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF950015',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
  },
});
