import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { queryService, manualsService } from '../../services';
import { useUsage } from '../../contexts/AppContext';
import { isEnhancedErrorHandlingEnabled } from '../../config/environment';
import { RateLimitIndicator } from '../../components/RateLimitIndicator';
import { EnhancedSourceCard } from '../../components/EnhancedSourceCard';
import { ManuelCompactBanner } from '../../components/ManuelBanner';
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
  const { refreshUsage } = useUsage();
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

      // Debug logging to see the actual response structure
      console.log('📋 Query response:', {
        answer: response.answer ? 'Present' : 'Missing',
        sources: response.sources ? `${response.sources.length} sources` : 'No sources',
        sourcesPreview: response.sources?.slice(0, 2).map(s => ({
          type: typeof s,
          keys: s ? Object.keys(s) : 'null',
          manual_name: s?.manual_name,
          page_number: s?.page_number,
          chunk_text: s?.chunk_text ? `${s.chunk_text.length} chars` : 'no content'
        }))
      });

      // Sanitize the response to prevent rendering errors
      const sanitizedResponse = {
        answer: String(response?.answer || 'No answer provided'),
        cost: typeof response?.cost === 'number' ? response.cost : 0,
        responseTime: typeof response?.responseTime === 'number' ? response.responseTime : 0,
        sources: Array.isArray(response?.sources) ? response.sources
          .filter(source => source && typeof source === 'object')
          .map(source => ({
            manual_name: String(source.manual_name || 'Unknown Manual'),
            page_number: typeof source.page_number === 'number' ? source.page_number : undefined,
            chunk_text: String(source.chunk_text || 'No content available'),
            score: typeof source.score === 'number' ? source.score : undefined,
            pdf_url: source.pdf_url || undefined,
            pdf_id: source.pdf_id || undefined,
          })) : []
      };

      setResult(sanitizedResponse);

      // Refresh usage data after successful query
      try {
        await refreshUsage();
      } catch (refreshError) {
        console.error('Failed to refresh usage after query:', refreshError);
      }
    } catch (error) {
      console.error('Query error:', error);

      // Handle different error types
      let errorMessage = 'Failed to get answer. Please try again.';

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

      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      <ManuelCompactBanner />
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
                placeholder="How do I do micro-timing on the Analog Rytm?"
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

          {result && (() => {
            try {
              return (
                <View style={styles.resultSection}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.resultTitle}>Answer</Text>
                    <TouchableOpacity onPress={clearResults}>
                      <Text style={styles.clearButton}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.answerCard}>
                    <Text style={styles.answerText}>{String(result.answer || 'No answer provided')}</Text>
                  </View>

                  <View style={styles.metaInfo}>
                    <Text style={styles.metaText}>
                      Response time: {result.responseTime || 0}ms • Cost: ${(result.cost || 0).toFixed(4)}
                    </Text>
                  </View>

                  {result.sources && Array.isArray(result.sources) && result.sources.length > 0 && (
                    <View style={styles.sourcesSection}>
                      <Text style={styles.sourcesTitle}>Sources</Text>
                      {result.sources
                        .filter(source => source && typeof source === 'object')
                        .map((source, index) => {
                          try {
                            // Ensure all text values are strings before rendering
                            const safeSource = {
                              manual_name: String(source.manual_name || 'Unknown Manual'),
                              page_number: typeof source.page_number === 'number' ? source.page_number : undefined,
                              chunk_text: String(source.chunk_text || 'No content available'),
                              score: typeof source.score === 'number' ? source.score : undefined,
                              pdf_url: source.pdf_url || undefined,
                              pdf_id: source.pdf_id || undefined,
                            };

                            return (
                              <EnhancedSourceCard
                                key={`source-${index}`}
                                source={safeSource}
                                index={index}
                                onGetPDFUrl={getPDFUrl}
                              />
                            );
                          } catch (error) {
                            console.error(`Error rendering source ${index}:`, error);
                            return (
                              <View key={`error-${index}`} style={styles.errorCard}>
                                <Text style={styles.errorText}>Error loading source {index + 1}</Text>
                              </View>
                            );
                          }
                        })}
                    </View>
                  )}
                </View>
              );
            } catch (error) {
              console.error('Error rendering result section:', error);
              return (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>Error displaying results</Text>
                </View>
              );
            }
          })()}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  errorCard: {
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFB3B3',
  },
  errorText: {
    fontSize: 14,
    color: '#CC0000',
    textAlign: 'center',
  },
});
