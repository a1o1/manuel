import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAudio, queryService } from '@manuel/shared';

interface QueryResult {
  answer: string;
  sources?: Array<{
    manual_name: string;
    page_number?: number;
    chunk_text: string;
  }>;
  cost: number;
  responseTime: number;
}

export function VoiceQueryScreen() {
  const navigation = useNavigation();
  const { startRecording, stopRecording, isRecording } = useAudio();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRecording) {
      // Start pulse animation
      const pulse = () => {
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isRecording) pulse();
        });
      };
      pulse();

      // Start timer
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      // Stop pulse animation
      pulseAnim.setValue(1);
      setRecordingTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, pulseAnim]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const handleStopRecording = async () => {
    setIsProcessing(true);

    try {
      const recording = await stopRecording();
      const audioBase64 = await recording.convertToBase64();

      const response = await queryService.voiceQuery(audioBase64, { includeSources: true });
      setResult(response);
    } catch (error) {
      Alert.alert('Error', 'Failed to process voice query. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDone = () => {
    navigation.goBack();
  };

  if (result) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDone}>
            <Text style={styles.doneButton}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={24} color="#34C759" />
            </View>
            <Text style={styles.resultTitle}>Answer</Text>
          </View>

          <View style={styles.answerCard}>
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
              {result.sources.slice(0, 2).map((source, index) => (
                <View key={index} style={styles.sourceCard}>
                  <View style={styles.sourceHeader}>
                    <Text style={styles.sourceName}>{source.manual_name}</Text>
                    {source.page_number && (
                      <Text style={styles.pageNumber}>Page {source.page_number}</Text>
                    )}
                  </View>
                  <Text style={styles.sourceText} numberOfLines={2}>
                    {source.chunk_text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.newQueryButton}
            onPress={() => setResult(null)}
          >
            <Text style={styles.newQueryButtonText}>Ask Another Question</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.instructions}>
          <Text style={styles.title}>Voice Query</Text>
          <Text style={styles.subtitle}>
            {isRecording
              ? 'Listening... Speak your question now'
              : isProcessing
              ? 'Processing your question...'
              : 'Tap the microphone to start asking your question'
            }
          </Text>
        </View>

        <View style={styles.recordingArea}>
          {isRecording && (
            <Text style={styles.timer}>{formatTime(recordingTime)}</Text>
          )}

          <Animated.View style={[styles.micContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[
                styles.micButton,
                isRecording && styles.micButtonRecording,
                isProcessing && styles.micButtonProcessing,
              ]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={isProcessing}
            >
              <Ionicons
                name={isRecording ? "stop" : isProcessing ? "time" : "mic"}
                size={48}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.micLabel}>
            {isRecording
              ? 'Tap to stop'
              : isProcessing
              ? 'Processing...'
              : 'Tap to start'
            }
          </Text>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Tips for better results:</Text>
          <Text style={styles.tipText}>• Speak clearly and at a normal pace</Text>
          <Text style={styles.tipText}>• Be specific with your question</Text>
          <Text style={styles.tipText}>• Mention the product name if relevant</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  cancelButton: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  doneButton: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  instructions: {
    alignItems: 'center',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  recordingArea: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  timer: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 20,
  },
  micContainer: {
    marginBottom: 20,
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  micButtonProcessing: {
    backgroundColor: '#8E8E93',
  },
  micLabel: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tips: {
    paddingBottom: 40,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    lineHeight: 20,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#34C75915',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  answerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
  },
  answerText: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 24,
  },
  metaInfo: {
    marginBottom: 24,
  },
  metaText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
  },
  sourcesSection: {
    marginBottom: 24,
  },
  sourcesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  sourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  pageNumber: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  sourceText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  newQueryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
  },
  newQueryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
