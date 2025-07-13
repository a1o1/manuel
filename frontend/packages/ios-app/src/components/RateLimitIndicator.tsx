import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usageService } from '../services';
import { getRateLimitConfig } from '../config/environment';

interface RateLimitStatus {
  currentRequests: number;
  maxRequests: number;
  resetTime: number;
  percentage: number;
}

interface Props {
  onPress?: () => void;
  compact?: boolean;
}

export function RateLimitIndicator({ onPress, compact = false }: Props) {
  const [status, setStatus] = useState<RateLimitStatus | null>(null);
  const [timeToReset, setTimeToReset] = useState<string>('');

  useEffect(() => {
    loadRateLimitStatus();
    const interval = setInterval(loadRateLimitStatus, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status?.resetTime) {
      updateTimeToReset();
      const interval = setInterval(updateTimeToReset, 1000); // Update every second
      return () => clearInterval(interval);
    }
  }, [status?.resetTime]);

  const loadRateLimitStatus = async () => {
    try {
      const quotaStatus = await usageService.getQuotaStatus();
      const rateLimitConfig = getRateLimitConfig();

      const currentRequests = quotaStatus.rateLimit?.current_requests || 0;
      const maxRequests = rateLimitConfig.REQUESTS_PER_WINDOW;
      const resetTime = quotaStatus.rateLimit?.reset_time || Date.now() + (rateLimitConfig.WINDOW_MINUTES * 60 * 1000);

      setStatus({
        currentRequests,
        maxRequests,
        resetTime,
        percentage: (currentRequests / maxRequests) * 100,
      });
    } catch (error) {
      // If we can't get rate limit status, show default
      const rateLimitConfig = getRateLimitConfig();
      setStatus({
        currentRequests: 0,
        maxRequests: rateLimitConfig.REQUESTS_PER_WINDOW,
        resetTime: Date.now() + (rateLimitConfig.WINDOW_MINUTES * 60 * 1000),
        percentage: 0,
      });
    }
  };

  const updateTimeToReset = () => {
    if (!status?.resetTime) return;

    const now = Date.now();
    const diff = status.resetTime - now;

    if (diff <= 0) {
      setTimeToReset('Resetting...');
      loadRateLimitStatus(); // Reload status when reset time is reached
      return;
    }

    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeToReset(`${minutes}:${seconds.toString().padStart(2, '0')}`);
  };

  const getStatusColor = () => {
    if (!status) return '#8E8E93';

    if (status.percentage >= 90) return '#FF3B30'; // Red
    if (status.percentage >= 75) return '#FF9500'; // Orange
    if (status.percentage >= 50) return '#FFCC00'; // Yellow
    return '#34C759'; // Green
  };

  const getStatusIcon = () => {
    if (!status) return 'speedometer-outline';

    if (status.percentage >= 90) return 'warning';
    if (status.percentage >= 75) return 'alert-circle-outline';
    return 'speedometer-outline';
  };

  if (!status) return null;

  if (compact) {
    return (
      <TouchableOpacity style={styles.compactContainer} onPress={onPress}>
        <Ionicons
          name={getStatusIcon()}
          size={16}
          color={getStatusColor()}
        />
        <Text style={[styles.compactText, { color: getStatusColor() }]}>
          {status.currentRequests}/{status.maxRequests}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.header}>
        <Ionicons
          name={getStatusIcon()}
          size={20}
          color={getStatusColor()}
        />
        <Text style={styles.title}>Rate Limit</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBackground}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${status.percentage}%`,
                backgroundColor: getStatusColor()
              }
            ]}
          />
        </View>
      </View>

      <View style={styles.details}>
        <Text style={styles.detailText}>
          {status.currentRequests} / {status.maxRequests} requests
        </Text>
        <Text style={styles.detailText}>
          Resets in {timeToReset}
        </Text>
      </View>

      {status.percentage >= 75 && (
        <View style={styles.warning}>
          <Ionicons name="information-circle-outline" size={14} color="#FF9500" />
          <Text style={styles.warningText}>
            {status.percentage >= 90
              ? 'Rate limit nearly reached'
              : 'Approaching rate limit'
            }
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBackground: {
    height: 4,
    backgroundColor: '#F2F2F7',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950015',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 6,
    fontWeight: '500',
  },
});
