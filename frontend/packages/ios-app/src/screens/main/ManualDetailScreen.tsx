import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { manualsService } from '@manuel/shared';
import type { RouteProp } from '@react-navigation/native';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type ManualDetailRouteProp = RouteProp<MainStackParamList, 'ManualDetail'>;

interface ManualDetail {
  id: string;
  name: string;
  uploadedAt: string;
  fileSize: number;
  status: 'processing' | 'ready' | 'error';
  pageCount?: number;
  description?: string;
  lastQueried?: string;
  queryCount?: number;
}

export function ManualDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<ManualDetailRouteProp>();
  const { manualId } = route.params;

  const [manual, setManual] = useState<ManualDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadManualDetail();
  }, [manualId]);

  const loadManualDetail = async () => {
    try {
      const response = await manualsService.getManual(manualId);
      setManual(response);
    } catch (error) {
      Alert.alert('Error', 'Failed to load manual details');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!manual) return;

    Alert.alert(
      'Delete Manual',
      `Are you sure you want to delete "${manual.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await manualsService.deleteManual(manual.id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete manual');
            }
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: ManualDetail['status']) => {
    switch (status) {
      case 'processing':
        return <Ionicons name="time-outline" size={20} color="#FF9500" />;
      case 'ready':
        return <Ionicons name="checkmark-circle-outline" size={20} color="#34C759" />;
      case 'error':
        return <Ionicons name="alert-circle-outline" size={20} color="#FF3B30" />;
    }
  };

  const getStatusText = (status: ManualDetail['status']) => {
    switch (status) {
      case 'processing':
        return 'Processing - Manual is being analyzed and indexed';
      case 'ready':
        return 'Ready - Manual is available for queries';
      case 'error':
        return 'Error - Manual processing failed';
    }
  };

  const getStatusColor = (status: ManualDetail['status']) => {
    switch (status) {
      case 'processing':
        return '#FF9500';
      case 'ready':
        return '#34C759';
      case 'error':
        return '#FF3B30';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading manual details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!manual) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Manual not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="document-text-outline" size={32} color="#007AFF" />
          </View>
          <Text style={styles.title} numberOfLines={3}>
            {manual.name}
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            {getStatusIcon(manual.status)}
            <Text style={[styles.statusText, { color: getStatusColor(manual.status) }]}>
              {manual.status.charAt(0).toUpperCase() + manual.status.slice(1)}
            </Text>
          </View>
          <Text style={styles.statusDescription}>
            {getStatusText(manual.status)}
          </Text>
        </View>

        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>File Size</Text>
            <Text style={styles.detailValue}>{formatFileSize(manual.fileSize)}</Text>
          </View>

          {manual.pageCount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Pages</Text>
              <Text style={styles.detailValue}>{manual.pageCount}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Uploaded</Text>
            <Text style={styles.detailValue}>{formatDate(manual.uploadedAt)}</Text>
          </View>

          {manual.queryCount !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Times Queried</Text>
              <Text style={styles.detailValue}>{manual.queryCount}</Text>
            </View>
          )}

          {manual.lastQueried && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Queried</Text>
              <Text style={styles.detailValue}>{formatDate(manual.lastQueried)}</Text>
            </View>
          )}
        </View>

        {manual.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.descriptionText}>{manual.description}</Text>
          </View>
        )}

        <View style={styles.actionsCard}>
          <Text style={styles.cardTitle}>Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Navigate to query screen with manual context
              navigation.navigate('MainTabs', {
                screen: 'Query',
                params: { manualId: manual.id }
              });
            }}
          >
            <View style={styles.actionButtonContent}>
              <View style={styles.actionIcon}>
                <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Ask Questions</Text>
                <Text style={styles.actionSubtitle}>Query this specific manual</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Alert.alert('Coming Soon', 'Manual preview will be available soon');
            }}
          >
            <View style={styles.actionButtonContent}>
              <View style={styles.actionIcon}>
                <Ionicons name="eye-outline" size={20} color="#34C759" />
              </View>
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Preview</Text>
                <Text style={styles.actionSubtitle}>View manual content</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <View style={styles.actionButtonContent}>
              <View style={[styles.actionIcon, { backgroundColor: '#FF3B3015' }]}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </View>
              <View style={styles.actionText}>
                <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>Delete Manual</Text>
                <Text style={styles.actionSubtitle}>Permanently remove this manual</Text>
              </View>
            </View>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 26,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  detailLabel: {
    fontSize: 16,
    color: '#000000',
  },
  detailValue: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'right',
    flex: 1,
    marginLeft: 16,
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  descriptionText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
  },
  actionButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  deleteButton: {
    borderBottomWidth: 0,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
