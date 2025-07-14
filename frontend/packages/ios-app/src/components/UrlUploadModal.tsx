import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { manualsService } from '../services';

interface UrlUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function UrlUploadModal({ visible, onClose, onSuccess }: UrlUploadModalProps) {
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    if (!isLoading) {
      setUrl('');
      setFilename('');
      onClose();
    }
  };

  const validateUrl = (urlString: string): boolean => {
    try {
      // Debug logging to understand what's happening
      console.log('Validating URL:', urlString);

      // Check for basic HTTPS URL pattern first
      const httpsPattern = /^https:\/\/.+\..+/i;
      if (!httpsPattern.test(urlString)) {
        console.log('URL failed regex test');
        return false;
      }

      // Try URL constructor (may not work in all React Native environments)
      try {
        const parsedUrl = new URL(urlString);
        console.log('URL constructor worked, protocol:', parsedUrl.protocol);
        return parsedUrl.protocol === 'https:';
      } catch (urlError) {
        console.log('URL constructor failed, falling back to regex validation');
        // Fallback to regex validation if URL constructor fails
        return httpsPattern.test(urlString);
      }
    } catch (error) {
      console.log('Validation error:', error);
      return false;
    }
  };

  const handleUpload = async () => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a URL');
      return;
    }

    if (!validateUrl(url.trim())) {
      Alert.alert('Error', 'Please enter a valid HTTPS URL');
      return;
    }

    setIsLoading(true);

    try {
      console.log('Starting URL upload:', url.trim(), 'filename:', filename.trim());

      const result = await manualsService.uploadFromUrl(
        url.trim(),
        filename.trim() || undefined
      );

      console.log('Upload result:', result);

      // Handle different response formats from backend
      const fileName = result.file_name || result.filename || result.manual_id || 'manual';
      const message = result.message || 'Manual uploaded successfully';

      Alert.alert(
        'Success!',
        `${message}. Manual "${fileName}" is being processed.`,
        [
          {
            text: 'OK',
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response,
        status: error?.status
      });

      let errorMessage = 'Failed to upload manual from URL';

      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      console.error('Final error message:', errorMessage);
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isLoading}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Upload from URL</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="link" size={48} color="#007AFF" />
            </View>

            <Text style={styles.description}>
              Enter the URL of a PDF manual to upload it to your library
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>URL *</Text>
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="https://example.com/manual.pdf"
                placeholderTextColor="#8E8E93"
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Custom Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={filename}
                onChangeText={setFilename}
                placeholder="My Product Manual"
                placeholderTextColor="#8E8E93"
                editable={!isLoading}
              />
              <Text style={styles.hint}>
                Leave blank to use the filename from the URL
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.uploadButton, isLoading && styles.uploadButtonDisabled]}
              onPress={handleUpload}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Uploading...</Text>
                </View>
              ) : (
                <Text style={styles.uploadButtonText}>Upload Manual</Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
              <Text style={styles.infoText}>
                Only HTTPS URLs are supported. The file will be downloaded and processed automatically.
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 16,
    marginLeft: 8,
    flex: 1,
  },
});
