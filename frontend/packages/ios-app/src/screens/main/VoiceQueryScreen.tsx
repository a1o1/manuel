import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAudioRecording } from '../../hooks/useAudioRecording';
import { queryService, manualsService } from '../../services';
import { isEnhancedErrorHandlingEnabled } from '../../config/environment';
import { EnhancedSourceCard } from '../../components/EnhancedSourceCard';
import { ManuelCompactBanner } from '../../components/ManuelBanner';

interface VoiceQueryResult {
  transcription: string;
  answer: string;
  sources?: Array<{
    manual_name: string;
    page_number?: number;
    chunk_text: string;
    score?: number;
    pdf_url?: string;
    pdf_id?: string;
  }>;
  cost: number;
  responseTime: number;
}

export function VoiceQueryScreen() {
  const navigation = useNavigation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<VoiceQueryResult | null>(null);
  const [manuals, setManuals] = useState<any[]>([]);

  // Load manuals list to help with PDF URL lookup
  useEffect(() => {
    const loadManuals = async () => {
      try {
        const manualsList = await manualsService.getManuals();
        setManuals(manualsList);
      } catch (error) {
        console.error('Error loading manuals for PDF lookup:', error);
      }
    };

    loadManuals();
  }, []);

  // Function to get PDF URL for a source by trying to match the manual name
  const getPDFUrl = async (source: any): Promise<string | null> => {
    try {
      // Try to find a manual that matches the source manual_name
      const matchedManual = manuals.find(manual => {
        // Try exact match first
        if (manual.name === source.manual_name) return true;

        // Try to match by manual ID if the manual_name looks like a UUID
        if (manual.id && manual.id.includes(source.manual_name.replace(/\s+/g, '-'))) return true;

        // Try to match by partial name
        if (manual.name.toLowerCase().includes(source.manual_name.toLowerCase())) return true;

        return false;
      });

      if (matchedManual) {
        // Get the manual detail which should include the PDF URL
        const manualDetail = await manualsService.getManualDetail(matchedManual.id);
        return manualDetail.pdfUrl || null;
      }

      return null;
    } catch (error) {
      console.error('Error getting PDF URL for source:', error);
      return null;
    }
  };

  const {
    state,
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    hasPermission,
    requestPermission,
  } = useAudioRecording();

  useEffect(() => {
    // Request permission when component mounts
    requestPermission();
  }, [requestPermission]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleStartRecording = async () => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          Alert.alert(
            'Microphone Permission Required',
            'Please allow microphone access to record voice queries.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setResult(null);
      await startRecording();
    } catch (error) {
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const handleStopRecording = async () => {
    setIsProcessing(true);
    try {
      console.log('Stopping recording...');
      const recordingResult = await stopRecording();
      console.log('Recording result:', recordingResult);

      if (recordingResult && recordingResult.audioUri) {
        console.log('Processing audio with query service...');
        console.log('Audio URI:', recordingResult.audioUri);
        console.log('Recording duration:', recordingResult.duration, 'ms');

        // Check if recording is long enough (minimum 1 second)
        if (recordingResult.duration < 1000) {
          Alert.alert(
            'Recording Too Short',
            'Please record for at least 1 second to ensure accurate transcription.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Process the audio with our query service
        const queryResult = await queryService.voiceQuery(recordingResult, {
          includeSources: true
        });

        console.log('Query result received:', queryResult);
        setResult(queryResult);
      } else {
        console.log('No audio data available from recording');
        Alert.alert('Recording Error', 'No audio data was captured. Please try recording again.');
      }
    } catch (error) {
      console.error('Voice query error:', error);

      // Handle different error types
      let errorMessage = 'Failed to process your voice query.';

      if (error instanceof Error) {
        if (error.message.includes('Rate limit exceeded')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
        } else if (error.message.includes('Authentication failed')) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      Alert.alert('Processing Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
    setResult(null);
  };

  const getRecordingButtonColor = () => {
    if (isRecording) return '#FF3B30';
    if (isPaused) return '#FF9500';
    return '#34C759';
  };

  const getRecordingButtonIcon = () => {
    if (isProcessing) return 'hourglass-outline';
    if (isRecording) return 'stop-outline';
    if (isPaused) return 'play-outline';
    return 'mic-outline';
  };

  const getRecordingButtonText = () => {
    if (isProcessing) return 'Transcribing audio... (this may take up to 2 minutes)';
    if (isRecording) return 'Tap to stop recording';
    if (isPaused) return 'Tap to resume';
    if (state === 'stopped') return 'Tap to record again';
    return 'Tap to start recording';
  };

  const handleRecordingButtonPress = () => {
    if (isProcessing) return;

    if (state === 'idle' || state === 'stopped') {
      handleStartRecording();
    } else if (isRecording) {
      handleStopRecording();
    } else if (isPaused) {
      resumeRecording();
    }
  };

  return (
    <View style={styles.container}>
      <ManuelCompactBanner />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#8E8E93" />
        </TouchableOpacity>
        <Text style={styles.title}>Voice Query</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.instructionContainer}>
          <Text style={styles.subtitle}>Ask Manuel anything about your manuals</Text>
          {!hasPermission && (
            <View style={styles.permissionWarning}>
              <Ionicons name="warning-outline" size={20} color="#FF9500" />
              <Text style={styles.permissionText}>Microphone permission required</Text>
            </View>
          )}
        </View>

        <View style={styles.recordingContainer}>
          <TouchableOpacity
            style={[styles.recordingButton, { backgroundColor: getRecordingButtonColor() }]}
            onPress={handleRecordingButtonPress}
            disabled={isProcessing}
          >
            <Ionicons name={getRecordingButtonIcon()} size={48} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.recordingText}>{getRecordingButtonText()}</Text>

          {(isRecording || isPaused) && (
            <View style={styles.recordingControls}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>

              <View style={styles.controlButtons}>
                {isRecording && (
                  <TouchableOpacity style={styles.controlButton} onPress={() => pauseRecording()}>
                    <Ionicons name="pause-outline" size={20} color="#007AFF" />
                    <Text style={styles.controlButtonText}>Pause</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.controlButton} onPress={handleCancelRecording}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  <Text style={styles.controlButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {state === 'stopped' && !isProcessing && !result && (
            <View style={styles.recordingComplete}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#34C759" />
              <Text style={styles.recordingCompleteText}>Recording complete!</Text>
            </View>
          )}
        </View>

        {result && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Ionicons name="chatbubble-outline" size={20} color="#007AFF" />
              <Text style={styles.resultTitle}>Query Result</Text>
            </View>

            {result.transcription && (
              <View style={styles.transcriptionCard}>
                <Text style={styles.transcriptionLabel}>You said:</Text>
                <Text style={styles.transcriptionText}>"{result.transcription}"</Text>
              </View>
            )}

            <View style={styles.answerCard}>
              <Text style={styles.answerLabel}>Answer:</Text>
              <Text style={styles.answerText}>{result.answer}</Text>
            </View>

            <View style={styles.metaInfo}>
              <Text style={styles.metaText}>
                Response time: {result.responseTime}ms • Cost: ${result.cost.toFixed(4)}
              </Text>
            </View>

            {result.sources && result.sources.length > 0 && (
              <View style={styles.sourcesSection}>
                <Text style={styles.sourcesTitle}>Sources</Text>
                {result.sources.map((source, index) => (
                  <EnhancedSourceCard
                    key={index}
                    source={source}
                    index={index}
                    onGetPDFUrl={getPDFUrl}
                  />
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.newQueryButton}
              onPress={() => {
                setResult(null);
                handleStartRecording();
              }}
            >
              <Ionicons name="mic-outline" size={16} color="#007AFF" />
              <Text style={styles.newQueryButtonText}>Ask Another Question</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF950015',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#FF9500',
    marginLeft: 8,
    fontWeight: '500',
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  recordingButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 16,
  },
  recordingControls: {
    alignItems: 'center',
    width: '100%',
  },
  durationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 16,
  },
  controlButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  controlButtonText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
  },
  recordingComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C75915',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  recordingCompleteText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    marginLeft: 8,
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  transcriptionCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  transcriptionLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#000000',
    fontStyle: 'italic',
  },
  answerCard: {
    marginBottom: 12,
  },
  answerLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  metaInfo: {
    marginBottom: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  sourcesSection: {
    marginBottom: 20,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  newQueryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF15',
    paddingVertical: 12,
    borderRadius: 8,
  },
  newQueryButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 6,
  },
});
