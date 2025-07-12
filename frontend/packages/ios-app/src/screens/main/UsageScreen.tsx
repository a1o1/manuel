import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUsage } from '@manuel/shared';

interface UsageStats {
  dailyQueries: number;
  dailyLimit: number;
  dailyRemaining: number;
  monthlyQueries: number;
  monthlyLimit: number;
  monthlyRemaining: number;
  dailyCost: number;
  monthlyCost: number;
  recentQueries: Array<{
    query: string;
    timestamp: string;
    cost: number;
    responseTime: number;
  }>;
}

export function UsageScreen() {
  const { usage, isLoading, refreshUsage } = useUsage();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUsage();
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getUsageColor = (used: number, limit: number): string => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return '#FF3B30';
    if (percentage >= 70) return '#FF9500';
    return '#34C759';
  };

  if (isLoading && !usage) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading usage statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Usage Statistics</Text>
          <Text style={styles.subtitle}>Monitor your query usage and costs</Text>
        </View>

        {usage && (
          <>
            {/* Daily Usage */}
            <View style={styles.usageCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="today-outline" size={20} color="#007AFF" />
                  <Text style={styles.cardTitle}>Today's Usage</Text>
                </View>
                <Text style={[styles.usagePercentage, { color: getUsageColor(usage.dailyQueries, usage.dailyLimit) }]}>
                  {Math.round((usage.dailyQueries / usage.dailyLimit) * 100)}%
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((usage.dailyQueries / usage.dailyLimit) * 100, 100)}%`,
                        backgroundColor: getUsageColor(usage.dailyQueries, usage.dailyLimit)
                      }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {usage.dailyQueries} of {usage.dailyLimit} queries used
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{usage.dailyRemaining}</Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{formatCurrency(usage.dailyCost || 0)}</Text>
                  <Text style={styles.statLabel}>Cost Today</Text>
                </View>
              </View>
            </View>

            {/* Monthly Usage */}
            <View style={styles.usageCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleContainer}>
                  <Ionicons name="calendar-outline" size={20} color="#5856D6" />
                  <Text style={styles.cardTitle}>Monthly Usage</Text>
                </View>
                <Text style={[styles.usagePercentage, { color: getUsageColor(usage.monthlyQueries, usage.monthlyLimit) }]}>
                  {Math.round((usage.monthlyQueries / usage.monthlyLimit) * 100)}%
                </Text>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min((usage.monthlyQueries / usage.monthlyLimit) * 100, 100)}%`,
                        backgroundColor: getUsageColor(usage.monthlyQueries, usage.monthlyLimit)
                      }
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {usage.monthlyQueries} of {usage.monthlyLimit} queries used
                </Text>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{usage.monthlyRemaining}</Text>
                  <Text style={styles.statLabel}>Remaining</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNumber}>{formatCurrency(usage.monthlyCost || 0)}</Text>
                  <Text style={styles.statLabel}>Cost This Month</Text>
                </View>
              </View>
            </View>

            {/* Recent Queries */}
            {usage.recentQueries && usage.recentQueries.length > 0 && (
              <View style={styles.recentCard}>
                <Text style={styles.cardTitle}>Recent Queries</Text>
                {usage.recentQueries.slice(0, 5).map((query, index) => (
                  <View key={index} style={styles.queryItem}>
                    <View style={styles.queryContent}>
                      <Text style={styles.queryText} numberOfLines={2}>
                        {query.query}
                      </Text>
                      <View style={styles.queryMeta}>
                        <Text style={styles.queryTime}>{formatDate(query.timestamp)}</Text>
                        <Text style={styles.queryDot}>•</Text>
                        <Text style={styles.queryCost}>{formatCurrency(query.cost)}</Text>
                        <Text style={styles.queryDot}>•</Text>
                        <Text style={styles.queryResponseTime}>{query.responseTime}ms</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Usage Tips */}
            <View style={styles.tipsCard}>
              <View style={styles.cardTitleContainer}>
                <Ionicons name="bulb-outline" size={20} color="#FF9500" />
                <Text style={styles.cardTitle}>Usage Tips</Text>
              </View>

              <View style={styles.tip}>
                <Text style={styles.tipTitle}>Optimize Your Queries</Text>
                <Text style={styles.tipText}>
                  Be specific with your questions to get better answers and use fewer follow-up queries.
                </Text>
              </View>

              <View style={styles.tip}>
                <Text style={styles.tipTitle}>Monitor Your Costs</Text>
                <Text style={styles.tipText}>
                  Voice queries typically cost more than text queries due to transcription processing.
                </Text>
              </View>

              <View style={styles.tip}>
                <Text style={styles.tipTitle}>Plan Your Usage</Text>
                <Text style={styles.tipText}>
                  Your quota resets daily and monthly. Plan complex research sessions accordingly.
                </Text>
              </View>
            </View>
          </>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
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
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  usagePercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#D1D1D6',
    marginHorizontal: 16,
  },
  recentCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 20,
  },
  queryItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  queryContent: {
    flex: 1,
  },
  queryText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
    marginBottom: 6,
  },
  queryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queryTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  queryDot: {
    fontSize: 12,
    color: '#8E8E93',
    marginHorizontal: 4,
  },
  queryCost: {
    fontSize: 12,
    color: '#8E8E93',
  },
  queryResponseTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  tipsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 20,
  },
  tip: {
    marginTop: 16,
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
