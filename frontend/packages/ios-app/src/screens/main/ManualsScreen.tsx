import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { manualsService } from '../../services';
import { UrlUploadModal } from '../../components/UrlUploadModal';
import { ManuelCompactBanner } from '../../components/ManuelBanner';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type ManualsScreenNavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface Manual {
  id: string;
  name: string;
  uploadDate: string;
  pages: number;
  size: string;
  status: 'processing' | 'processed' | 'failed';
}

export function ManualsScreen() {
  const navigation = useNavigation<ManualsScreenNavigationProp>();
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showUrlUpload, setShowUrlUpload] = useState(false);

  const loadManuals = async () => {
    try {
      console.log('Loading manuals...');
      const response = await manualsService.getManuals();
      console.log('Manuals response:', response);

      // Handle the CLI format: { manuals: Manual[], count: number }
      let manualsArray = [];
      if (response && typeof response === 'object') {
        if (Array.isArray(response.manuals)) {
          manualsArray = response.manuals;
        } else if (Array.isArray(response)) {
          manualsArray = response;
        }
      }

      console.log('Extracted manuals array:', manualsArray);

      // Transform backend data to UI format
      const transformedManuals = manualsArray.map(transformManual);
      console.log('Transformed manuals:', transformedManuals);

      setManuals(transformedManuals);
    } catch (error) {
      console.error('Error loading manuals:', error);
      Alert.alert('Error', `Failed to load manuals: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Transform backend manual format to UI format
  const transformManual = (manual: any): Manual => {
    console.log('Transforming manual:', manual);
    const transformed = {
      id: manual.key || manual.id || manual.file_key || 'unknown-id',
      name: manual.filename || manual.name || manual.original_filename || 'Unknown Manual',
      uploadDate: manual.last_modified || manual.upload_date || manual.created_at || 'Unknown',
      pages: manual.pages || 0,
      size: manual.size_formatted || manual.size || '0 bytes',
      status: manual.processing_status === 'COMPLETED' ? 'processed' :
              manual.processing_status === 'IN_PROGRESS' ? 'processing' :
              manual.processing_status === 'FAILED' ? 'failed' : 'processed'
    };
    console.log('Transformed to:', transformed);
    return transformed;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadManuals();
    setIsRefreshing(false);
  };

  useEffect(() => {
    loadManuals();
  }, []);

  const handleUpload = () => {
    // Directly open URL upload modal for now (file upload can be added later)
    setShowUrlUpload(true);
  };

  const simulateFileUpload = async () => {
    try {
      // Simulate file selection and upload
      const mockFile = new File(['mock content'], 'User Manual.pdf', { type: 'application/pdf' });

      Alert.alert('Uploading...', 'Your manual is being processed');

      const newManual = await manualsService.uploadManual(mockFile);
      setManuals(prev => [newManual, ...prev]);

      Alert.alert('Success', 'Manual uploaded successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload manual');
    }
  };

  const handleUrlUpload = () => {
    setShowUrlUpload(true);
  };

  const handleUrlUploadSuccess = () => {
    loadManuals(); // Refresh the manuals list
  };

  const handleManualPress = (manual: Manual) => {
    if (manual.status === 'processed') {
      navigation.navigate('ManualDetail', { manualId: manual.id });
    } else if (manual.status === 'processing') {
      Alert.alert('Processing', 'This manual is still being processed. Please try again later.');
    } else {
      Alert.alert('Error', 'This manual failed to process. Please try uploading again.');
    }
  };

  const handleDeleteManual = (manual: Manual) => {
    Alert.alert(
      'Delete Manual',
      `Are you sure you want to delete "${manual.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await manualsService.deleteManual(manual.id);
              setManuals(prev => prev.filter(m => m.id !== manual.id));
              Alert.alert('Success', 'Manual deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete manual');
            }
          }
        }
      ]
    );
  };

  const getStatusIcon = (status: Manual['status']) => {
    switch (status) {
      case 'processed':
        return 'checkmark-circle-outline';
      case 'processing':
        return 'hourglass-outline';
      case 'failed':
        return 'alert-circle-outline';
    }
  };

  const getStatusColor = (status: Manual['status']) => {
    switch (status) {
      case 'processed':
        return '#34C759';
      case 'processing':
        return '#FF9500';
      case 'failed':
        return '#FF3B30';
    }
  };

  const renderManual = (manual: Manual) => (
    <TouchableOpacity
      key={manual.id}
      style={styles.manualCard}
      onPress={() => handleManualPress(manual)}
    >
      <View style={styles.manualHeader}>
        <View style={styles.manualIcon}>
          <Ionicons name="document-text-outline" size={24} color="#007AFF" />
        </View>
        <View style={styles.manualInfo}>
          <Text style={styles.manualName} numberOfLines={1}>
            {manual.name}
          </Text>
          <Text style={styles.manualMeta}>
            {manual.pages} pages • {manual.size} • {manual.uploadDate}
          </Text>
        </View>
        <View style={styles.manualActions}>
          <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(manual.status)}15` }]}>
            <Ionicons
              name={getStatusIcon(manual.status)}
              size={12}
              color={getStatusColor(manual.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(manual.status) }]}>
              {manual.status}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteManual(manual)}
          >
            <Ionicons name="trash-outline" size={16} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ManuelCompactBanner />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading manuals...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ManuelCompactBanner />
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Manuals</Text>
          <Text style={styles.subtitle}>
            {manuals.length} manual{manuals.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleUpload}>
          <Ionicons name="link" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        style={styles.flatList}
        data={manuals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderManual(item)}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={100}
        initialNumToRender={10}
        windowSize={10}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="library-outline" size={48} color="#8E8E93" />
            </View>
            <Text style={styles.emptyTitle}>No Manuals Yet</Text>
            <Text style={styles.emptyText}>
              Upload your first manual to get started with Manuel
            </Text>

            <TouchableOpacity style={styles.uploadButton} onPress={() => setShowUrlUpload(true)}>
              <Ionicons name="link-outline" size={20} color="#FFFFFF" />
              <Text style={styles.uploadButtonText}>Add Manual from URL</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={() => (
          <View style={styles.tipSection}>
            <View style={styles.tipCard}>
              <Ionicons name="information-circle-outline" size={20} color="#007AFF" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Supported Formats</Text>
                <Text style={styles.tipText}>
                  PDF, DOC, DOCX files up to 10MB. Processing typically takes 1-2 minutes.
                </Text>
              </View>
            </View>
          </View>
        )}
      />

      <UrlUploadModal
        visible={showUrlUpload}
        onClose={() => setShowUrlUpload(false)}
        onSuccess={handleUrlUploadSuccess}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  headerContent: {
    flex: 1,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    padding: 16,
    flexGrow: 1,
  },
  manualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#007AFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  manualInfo: {
    flex: 1,
  },
  manualName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  manualMeta: {
    fontSize: 12,
    color: '#8E8E93',
  },
  manualActions: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  deleteButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tipSection: {
    padding: 16,
    paddingTop: 0,
  },
  tipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
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
