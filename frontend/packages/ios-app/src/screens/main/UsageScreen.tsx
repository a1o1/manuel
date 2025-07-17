import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUsage } from '../../contexts/AppContext';
import { usageService } from '../../services/index';

interface ProgressBarProps {
  value: number;
  max: number;
  color: string;
  backgroundColor?: string;
}

function ProgressBar({ value, max, color, backgroundColor = '#E5E7EB' }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <View style={[styles.progressContainer, { backgroundColor }]}>
      <View
        style={[
          styles.progressBar,
          { width: `${percentage}%`, backgroundColor: color }
        ]}
      />
    </View>
  );
}

function formatCurrency(amount: number, currency: string = 'EUR'): string {
  console.log('formatCurrency called with:', { amount, currency });
  if (currency === 'EUR') {
    return `€${amount.toFixed(2)}`;
  }
  return `${currency}${amount.toFixed(2)}`;
}

export function UsageScreen() {
  const { usage, isLoading } = useUsage();
  const [refreshing, setRefreshing] = useState(false);
  const [quotas, setQuotas] = useState<any>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  console.log('UsageScreen - usage data:', usage);

  useEffect(() => {
    loadQuotas();
  }, []);

  const loadQuotas = async () => {
    try {
      const quotaData = await usageService.getQuotas();
      setQuotas(quotaData);
    } catch (error) {
      console.error('Failed to load quotas:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadQuotas();
      // The usage context will handle refreshing usage data
    } finally {
      setRefreshing(false);
    }
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return '#EF4444'; // Red
    if (percentage >= 75) return '#F59E0B'; // Orange
    if (percentage >= 50) return '#3B82F6'; // Blue
    return '#10B981'; // Green
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'CRITICAL': return '#EF4444';
      case 'WARNING': return '#F59E0B';
      case 'MODERATE': return '#3B82F6';
      default: return '#10B981';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading usage data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Usage Statistics</Text>
          <Text style={styles.subtitle}>Track your Manuel usage and costs</Text>
          {quotas && (
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(quotas.status) }]}>
              <Text style={styles.statusText}>{quotas.status}</Text>
            </View>
          )}
        </View>

        {usage && quotas && (
          <>
            {/* Daily Usage Card */}
            <TouchableOpacity
              style={styles.section}
              onPress={() => setExpandedCard(expandedCard === 'daily' ? null : 'daily')}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Daily Usage</Text>
                <Text style={styles.expandIcon}>{expandedCard === 'daily' ? '▼' : '▶'}</Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {usage.dailyQueries} / {usage.dailyLimit} queries
                  </Text>
                  <Text style={styles.progressCost}>
                    {formatCurrency(usage.dailyCost, usage.currency)}
                  </Text>
                </View>
                <ProgressBar
                  value={usage.dailyQueries}
                  max={usage.dailyLimit}
                  color={getProgressColor(quotas.daily.percentUsed)}
                />
                <Text style={styles.progressPercentage}>
                  {quotas.daily.percentUsed.toFixed(1)}% used
                </Text>
              </View>

              {expandedCard === 'daily' && usage.costBreakdown && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedTitle}>Cost Breakdown</Text>
                  <View style={styles.costGrid}>
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Bedrock</Text>
                      <Text style={styles.costValue}>{formatCurrency(usage.costBreakdown.bedrock, usage.currency)}</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Transcribe</Text>
                      <Text style={styles.costValue}>{formatCurrency(usage.costBreakdown.transcribe, usage.currency)}</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>Lambda</Text>
                      <Text style={styles.costValue}>{formatCurrency(usage.costBreakdown.lambda, usage.currency)}</Text>
                    </View>
                    <View style={styles.costItem}>
                      <Text style={styles.costLabel}>S3</Text>
                      <Text style={styles.costValue}>{formatCurrency(usage.costBreakdown.s3, usage.currency)}</Text>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Monthly Usage Card */}
            <TouchableOpacity
              style={styles.section}
              onPress={() => setExpandedCard(expandedCard === 'monthly' ? null : 'monthly')}
            >
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Monthly Usage</Text>
                <Text style={styles.expandIcon}>{expandedCard === 'monthly' ? '▼' : '▶'}</Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressInfo}>
                  <Text style={styles.progressText}>
                    {usage.monthlyQueries} / {usage.monthlyLimit} queries
                  </Text>
                  <Text style={styles.progressCost}>
                    {formatCurrency(usage.monthlyCost, usage.currency)}
                  </Text>
                </View>
                <ProgressBar
                  value={usage.monthlyQueries}
                  max={usage.monthlyLimit}
                  color={getProgressColor(quotas.monthly.percentUsed)}
                />
                <Text style={styles.progressPercentage}>
                  {quotas.monthly.percentUsed.toFixed(1)}% used
                </Text>
              </View>

              {expandedCard === 'monthly' && usage.operationBreakdown && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedTitle}>Operation Breakdown</Text>
                  <View style={styles.operationGrid}>
                    <View style={styles.operationItem}>
                      <Text style={styles.operationLabel}>Text Queries</Text>
                      <Text style={styles.operationValue}>{usage.operationBreakdown.query}</Text>
                    </View>
                    <View style={styles.operationItem}>
                      <Text style={styles.operationLabel}>Voice Queries</Text>
                      <Text style={styles.operationValue}>{usage.operationBreakdown.transcribe}</Text>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Recent Queries Card */}
            {usage.recentQueries && usage.recentQueries.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Queries</Text>
                {usage.recentQueries.slice(0, 5).map((query, index) => (
                  <View key={index} style={styles.queryItem}>
                    <View style={styles.queryInfo}>
                      <Text style={styles.queryOperation}>{query.operation}</Text>
                      <Text style={styles.queryTime}>
                        {new Date(query.timestamp).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={styles.queryCost}>
                      {formatCurrency(query.cost, query.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
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
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
    position: 'relative',
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
  statusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  expandIcon: {
    fontSize: 16,
    color: '#8E8E93',
  },
  progressSection: {
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  progressCost: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
  progressContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'right',
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  costItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  costLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  costValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  operationGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  operationItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    minWidth: 100,
  },
  operationLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  operationValue: {
    fontSize: 20,
    color: '#000000',
    fontWeight: 'bold',
  },
  queryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  queryInfo: {
    flex: 1,
  },
  queryOperation: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  queryTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  queryCost: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
});
