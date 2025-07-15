import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { queryService, manualsService } from '../../services';
import { showErrorToUser, ManuelError } from '../../services/real/errorHandler';
import { isEnhancedErrorHandlingEnabled } from '../../config/environment';
import { RateLimitIndicator } from '../../components/RateLimitIndicator';
import { EnhancedSourceCard } from '../../components/EnhancedSourceCard';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/MainNavigator';

type QueryScreenNavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface QueryResult {
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

export function QueryScreen() {
  const navigation = useNavigation<QueryScreenNavigationProp>();
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [includeSources, setIncludeSources] = useState(true);
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

  const handleSubmit = async () => {
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await queryService.textQuery(query.trim(), { includeSources });
      setResult(response);
    } catch (error) {
      if (isEnhancedErrorHandlingEnabled() && error instanceof Error) {
        const manuelError = error as ManuelError;
        showErrorToUser(manuelError, 'Query Failed');
      } else {
        Alert.alert('Error', 'Failed to get answer. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setQuery('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.inputSection}>
            <Text style={styles.title}>Ask Manuel</Text>
            <Text style={styles.subtitle}>
              Ask any question about your product manuals
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={query}
                onChangeText={setQuery}
                placeholder="How do I reset my WiFi password?"
                placeholderTextColor="#8E8E93"
                multiline
                maxLength={500}
                editable={!isLoading}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.characterCount}>{query.length}/500</Text>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={() => navigation.navigate('VoiceQuery')}
                >
                  <Ionicons name="mic-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => setIncludeSources(!includeSources)}
              >
                <View style={styles.checkbox}>
                  {includeSources && (
                    <Ionicons name="checkmark" size={16} color="#007AFF" />
                  )}
                </View>
                <Text style={styles.optionText}>Include source references</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.submitButton, (!query.trim() || isLoading) && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!query.trim() || isLoading}
              >
                <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  {isLoading ? 'Getting Answer...' : 'Ask Manuel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.voiceQueryButton}
                onPress={() => navigation.navigate('VoiceQuery')}
              >
                <Ionicons name="mic-outline" size={16} color="#007AFF" />
                <Text style={styles.voiceQueryButtonText}>Voice Query</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.rateLimitSection}>
            <RateLimitIndicator compact />
          </View>

          {result && (
            <View style={styles.resultSection}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>Answer</Text>
                <TouchableOpacity onPress={clearResults}>
                  <Text style={styles.clearButton}>Clear</Text>
                </TouchableOpacity>
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
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
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
    marginBottom: 24,
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    color: '#000000',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  characterCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  voiceButton: {
    padding: 8,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#000000',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 6,
  },
  voiceQueryButton: {
    backgroundColor: '#007AFF15',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  voiceQueryButtonText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollContent: {
    flexGrow: 1,
  },
  rateLimitSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  resultSection: {
    padding: 20,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  clearButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
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
    marginTop: 8,
  },
  sourcesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
});
