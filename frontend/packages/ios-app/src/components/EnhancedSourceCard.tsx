import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Source {
  manual_name: string;
  page_number?: number;
  chunk_text: string;
  score?: number;
  // New fields for PDF viewing
  pdf_url?: string;
  pdf_id?: string;
}

interface EnhancedSourceCardProps {
  source: Source;
  index: number;
  onPDFView?: (source: Source) => void;
  onGetPDFUrl?: (source: Source) => Promise<string | null>;
}

export function EnhancedSourceCard({ source, index, onPDFView, onGetPDFUrl }: EnhancedSourceCardProps) {
  const handlePDFView = async () => {
    let pdfUrl = source.pdf_url;

    // If no PDF URL in source, try to get it dynamically
    if (!pdfUrl && onGetPDFUrl) {
      try {
        pdfUrl = await onGetPDFUrl(source);
      } catch (error) {
        console.error('Error getting PDF URL:', error);
      }
    }

    if (pdfUrl) {
      try {
        // Open PDF in external browser/PDF viewer
        const canOpen = await Linking.canOpenURL(pdfUrl);
        if (canOpen) {
          await Linking.openURL(pdfUrl);
        } else {
          Alert.alert('Error', 'Unable to open PDF. Please check if you have a PDF viewer installed.');
        }
      } catch (error) {
        console.error('Error opening PDF:', error);
        Alert.alert('Error', 'Failed to open PDF. Please try again.');
      }
    } else if (onPDFView) {
      // Use custom handler if no PDF URL
      onPDFView(source);
    } else {
      // Fallback behavior for demo - use a sample PDF
      console.warn('No PDF URL available for source:', source.manual_name);
      try {
        // For demo purposes, open a sample PDF
        const samplePdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
        const canOpen = await Linking.canOpenURL(samplePdfUrl);
        if (canOpen) {
          await Linking.openURL(samplePdfUrl);
        } else {
          Alert.alert('Demo PDF', 'PDF viewing will be available once the backend provides PDF URLs.');
        }
      } catch (error) {
        Alert.alert('Demo PDF', 'PDF viewing will be available once the backend provides PDF URLs.');
      }
    }
  };

  const canViewPDF = (source.pdf_url && source.pdf_id) || onPDFView || true; // Always show for demo

  return (
    <View style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceName}>{source.manual_name}</Text>
          {source.page_number && (
            <Text style={styles.pageNumber}>Page {source.page_number}</Text>
          )}
        </View>

        {source.score && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              {Math.round(source.score * 100)}%
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sourceText} numberOfLines={3}>
        {source.chunk_text}
      </Text>

      <View style={styles.sourceActions}>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => {
            // TODO: Implement expand text functionality
            console.log('Expand text for source:', index);
          }}
        >
          <Ionicons name="text-outline" size={16} color="#8E8E93" />
          <Text style={styles.actionText}>Read More</Text>
        </TouchableOpacity>

        {canViewPDF && (
          <TouchableOpacity
            style={styles.pdfButton}
            onPress={handlePDFView}
          >
            <Ionicons name="open-outline" size={16} color="#007AFF" />
            <Text style={styles.pdfButtonText}>Open PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sourceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  pageNumber: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  scoreContainer: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  scoreText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  sourceText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 20,
    marginBottom: 12,
  },
  sourceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 6,
    fontWeight: '500',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pdfButtonText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '600',
  },
});
