import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { manualsService } from '@manuel/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type ManualsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface Manual {
  id: string;
  name: string;
  uploadedAt: string;
  fileSize: number;
  status: 'processing' | 'ready' | 'error';
  pageCount?: number;
}

export function ManualsScreen() {
  const navigation = useNavigation<ManualsScreenNavigationProp>();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadManuals = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const response = await manualsService.getManuals();
      setManuals(response.manuals || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load manuals');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadManuals();
  }, []);

  const handleRefresh = () => {
    loadManuals(true);
  };

  const handleDeleteManual = (manual: Manual) => {
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
              setManuals(prev => prev.filter(m => m.id !== manual.id));
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
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: Manual['status']) => {
    switch (status) {
      case 'processing':
        return <Ionicons name="time-outline" size={16} color="#FF9500" />;
      case 'ready':
        return <Ionicons name="checkmark-circle-outline" size={16} color="#34C759" />;
      case 'error':
        return <Ionicons name="alert-circle-outline" size={16} color="#FF3B30" />;
    }
  };

  const getStatusText = (status: Manual['status']) => {
    switch (status) {
      case 'processing':
        return 'Processing';
      case 'ready':
        return 'Ready';
      case 'error':
        return 'Error';
    }
  };

  const renderManual = ({ item }: { item: Manual }) => (
    <TouchableOpacity
      style={styles.manualCard}
      onPress={() => navigation.navigate('ManualDetail', { manualId: item.id })}
    >
      <View style={styles.manualHeader}>
        <View style={styles.manualInfo}>
          <Text style={styles.manualName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.manualMeta}>
            <View style={styles.statusContainer}>
              {getStatusIcon(item.status)}
              <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                {getStatusText(item.status)}
              </Text>
            </View>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>{formatFileSize(item.fileSize)}</Text>
            {item.pageCount && (
              <>
                <Text style={styles.metaText}>•</Text>
                <Text style={styles.metaText}>{item.pageCount} pages</Text>
              </>
            )}
          </View>
          <Text style={styles.dateText}>Uploaded {formatDate(item.uploadedAt)}</Text>
        </View>

        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => handleDeleteManual(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const getStatusColor = (status: Manual['status']) => {
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
          <Text style={styles.loadingText}>Loading manuals...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Manuals</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {manuals.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="library-outline" size={48} color="#8E8E93" />
          </View>
          <Text style={styles.emptyTitle}>No Manuals Yet</Text>
          <Text style={styles.emptySubtitle}>
            Upload your first manual to start asking questions
          </Text>
          <TouchableOpacity style={styles.uploadButton}>
            <Text style={styles.uploadButtonText}>Upload Manual</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={manuals}
          keyExtractor={(item) => item.id}
          renderItem={renderManual}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
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
  listContainer: {
    padding: 16,
  },
  manualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  manualInfo: {
    flex: 1,
    marginRight: 12,
  },
  manualName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  manualMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
    marginHorizontal: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B3015',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
});
