import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pdfService } from '../services';

// Helper function to extract meaningful search terms from chunk text
function extractSearchTerms(text: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);

  // Extract words that are likely to be important for search
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .filter(word => !/^\d+$/.test(word)); // Remove pure numbers

  // Return unique terms, prioritizing longer words
  const uniqueWords = [...new Set(words)];
  return uniqueWords.sort((a, b) => b.length - a.length);
}

// Helper function to try different PDF viewer apps with page navigation
async function tryPdfViewerApps(pdfUrl: string, pageNumber?: number): Promise<void> {
  if (!pageNumber) {
    // No page number, just open normally
    await Linking.openURL(pdfUrl);
    return;
  }

  console.log(`Trying different PDF viewer approaches for page ${pageNumber}...`);

  // List of PDF viewer URL schemes and their page parameter formats
  const pdfViewerAttempts = [
    // Adobe Acrobat Reader
    {
      name: 'Adobe Acrobat',
      canOpenCheck: 'com.adobe.Adobe-Reader://',
      urlFormat: (url: string, page: number) => `com.adobe.Adobe-Reader://open?url=${encodeURIComponent(url)}&page=${page}`
    },
    // PDF Viewer Pro
    {
      name: 'PDF Viewer Pro',
      canOpenCheck: 'pdfviewer://',
      urlFormat: (url: string, page: number) => `pdfviewer://open?url=${encodeURIComponent(url)}&page=${page}`
    },
    // Documents by Readdle
    {
      name: 'Documents by Readdle',
      canOpenCheck: 'readdle-spark://',
      urlFormat: (url: string, page: number) => `readdle-spark://open?url=${encodeURIComponent(url)}&page=${page}`
    },
    // Fallback to standard URL with page fragment
    {
      name: 'Default Browser/PDF Viewer',
      canOpenCheck: pdfUrl,
      urlFormat: (url: string, page: number) => `${url}#page=${page}`
    }
  ];

  // Try each PDF viewer in order
  for (const viewer of pdfViewerAttempts) {
    try {
      const canOpen = await Linking.canOpenURL(viewer.canOpenCheck);
      if (canOpen) {
        console.log(`Attempting to open with ${viewer.name}`);
        const viewerUrl = viewer.urlFormat(pdfUrl, pageNumber);
        console.log(`Using URL: ${viewerUrl}`);
        await Linking.openURL(viewerUrl);
        return; // Success, stop trying other viewers
      }
    } catch (error) {
      console.log(`${viewer.name} failed:`, error);
      continue; // Try next viewer
    }
  }

  // If all specific viewers failed, try the original URL
  console.log('All PDF viewers failed, opening original URL');
  await Linking.openURL(pdfUrl);
}

// Helper function to generate Google Docs viewer URL (simple fallback)
function generateGoogleDocsUrl(pdfUrl: string): string {
  return `https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`;
}

// Helper function to extract and view specific PDF page
async function viewPDFPageInline(pdfUrl: string, pageNumber: number, highlightText?: string): Promise<void> {
  try {
    console.log(`Extracting page ${pageNumber} from PDF with highlighting: ${highlightText}`);

    const response = await pdfService.extractPage({
      pdf_url: pdfUrl,
      page_number: pageNumber,
      highlight_text: highlightText,
      highlight_color: 'yellow'
    });

    console.log('PDF page extracted successfully:', response);

    // Check if the response contains a data URL (base64 encoded image)
    if (response.page_image_url.startsWith('data:image/')) {
      // Show success message for data URLs
      Alert.alert(
        'PDF Page Extracted',
        `Successfully extracted page ${pageNumber}!\n\n` +
        `📄 Manual: ${response.manual_name || 'Unknown'}\n` +
        `📖 Page: ${response.page_number}\n` +
        `🔍 Highlight: ${highlightText || 'None'}\n` +
        `⏱️ Processing: ${response.processing_time_ms}ms\n` +
        `💾 Cached: ${response.cached ? 'Yes' : 'No'}\n\n` +
        `Note: PDF processing is working with fallback libraries.`,
        [
          {
            text: 'OK',
            style: 'default',
          }
        ]
      );
    } else {
      // For regular URLs (S3 signed URLs), try to open them
      try {
        await Linking.openURL(response.page_image_url);

        // Show success toast with processing details
        console.log(`✅ PDF Page Opened Successfully:
          📄 Page: ${response.page_number}
          🔍 Highlight: ${highlightText || 'None'}
          ⏱️ Processing: ${response.processing_time_ms}ms
          💾 Cached: ${response.cached ? 'Yes' : 'No'}
          🔗 URL: ${response.page_image_url.substring(0, 50)}...`);

      } catch (linkError) {
        console.error('Failed to open PDF page URL:', linkError);
        Alert.alert(
          'PDF Page Ready',
          `Page ${pageNumber} was processed successfully but couldn't be opened automatically.\n\n` +
          `📄 Page: ${response.page_number}\n` +
          `🔍 Highlight: ${highlightText || 'None'}\n` +
          `⏱️ Processing: ${response.processing_time_ms}ms\n` +
          `💾 Cached: ${response.cached ? 'Yes' : 'No'}\n\n` +
          `The PDF page extraction is working correctly.`,
          [
            {
              text: 'OK',
              style: 'default',
            }
          ]
        );
      }
    }

  } catch (error) {
    console.error('Error extracting PDF page:', error);
    Alert.alert('Error', 'Failed to extract PDF page. Please try the full PDF option.');
  }
}

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

// Helper function to validate and normalize source data
function validateAndNormalizeSource(source: any): Source {
  // Handle case where source might be wrapped in another object
  const actualSource = source?.source || source;

  return {
    manual_name: String(actualSource?.manual_name || actualSource?.metadata?.source || 'Unknown Manual'),
    page_number: typeof actualSource?.page_number === 'number' ? actualSource.page_number : undefined,
    chunk_text: String(actualSource?.chunk_text || actualSource?.content || 'No content available'),
    score: typeof actualSource?.score === 'number' ? actualSource.score : undefined,
    pdf_url: actualSource?.pdf_url || undefined,
    pdf_id: actualSource?.pdf_id || undefined,
  };
}

export function EnhancedSourceCard({ source, index, onPDFView, onGetPDFUrl }: EnhancedSourceCardProps) {

  // Early return if source is null/undefined
  if (!source) {
    return (
      <View style={styles.sourceCard}>
        <Text style={styles.errorText}>No source data available</Text>
      </View>
    );
  }

  // Validate and normalize source data
  const normalizedSource = validateAndNormalizeSource(source);

  // Debug logging to see actual source structure (only if needed)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Source data:', {
      index,
      originalSource: source,
      normalizedSource,
    });
  }

  const handlePDFView = async () => {
    let pdfUrl = normalizedSource.pdf_url;

    // If no PDF URL in source, try to get it dynamically
    if (!pdfUrl && onGetPDFUrl) {
      try {
        pdfUrl = await onGetPDFUrl(normalizedSource);
      } catch (error) {
        console.error('Error getting PDF URL:', error);
      }
    }

    if (pdfUrl) {
      // Create enhanced PDF URLs with page navigation
      const hasPageNumber = normalizedSource.page_number && typeof normalizedSource.page_number === 'number';
      const hasSearchTerms = normalizedSource.chunk_text && typeof normalizedSource.chunk_text === 'string';

      // Generate enhanced URLs for different viewers
      const googleDocsUrl = generateGoogleDocsUrl(pdfUrl);

      // Log the URLs for debugging
      console.log('📄 Opening PDF:', {
        manual: normalizedSource.manual_name,
        page: normalizedSource.page_number,
        hasSearchTerms: hasSearchTerms,
        pdfUrl: pdfUrl,
        googleDocsUrl: googleDocsUrl
      });

      try {
        const canOpen = await Linking.canOpenURL(pdfUrl);
        if (canOpen) {
          // Show user-friendly options for PDF viewing with page navigation
          if (hasPageNumber) {
            const options = [];

            // Add cancel option
            options.push({
              text: 'Cancel',
              style: 'cancel',
            });

            // Option 1: View highlighted page inline (server-side processing)
            options.push({
              text: `View Page ${normalizedSource.page_number} (Highlighted)`,
              onPress: () => viewPDFPageInline(pdfUrl, normalizedSource.page_number, normalizedSource.chunk_text),
            });

            // Option 2: Try different PDF viewer apps for full PDF
            options.push({
              text: `Open Full PDF at Page ${normalizedSource.page_number}`,
              onPress: () => tryPdfViewerApps(pdfUrl, normalizedSource.page_number),
            });

            // Option 3: Open full PDF without page navigation
            options.push({
              text: 'Open Full PDF (Start at Beginning)',
              onPress: () => Linking.openURL(pdfUrl),
            });

            // Option 4: Google Docs viewer
            options.push({
              text: 'Google Docs Viewer',
              onPress: () => Linking.openURL(googleDocsUrl),
            });

            const alertTitle = `View "${normalizedSource.manual_name}" (Page ${normalizedSource.page_number})`;
            const alertMessage = `Choose your viewing option:\n\n• Highlighted Page: Server-processed page with text highlighting\n• Full PDF (Page ${normalizedSource.page_number}): Attempts page navigation in PDF app\n• Full PDF (Beginning): Opens complete PDF normally\n• Google Docs: Online viewer fallback`;

            Alert.alert(alertTitle, alertMessage, options);
          } else {
            // No page number - just open directly
            await Linking.openURL(pdfUrl);
          }
        } else {
          Alert.alert('Error', 'Unable to open PDF. Please check if you have a PDF viewer installed.');
        }
      } catch (error) {
        console.error('Error opening PDF:', error);
        Alert.alert('Error', 'Failed to open PDF. Please try again.');
      }
    } else if (onPDFView) {
      // Use custom handler if no PDF URL
      onPDFView(normalizedSource);
    } else {
      // Fallback behavior for demo - use a sample PDF with page navigation and search
      console.warn('No PDF URL available for source:', normalizedSource.manual_name);
      let samplePdfUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

      const urlParams = [];

      // Add page navigation to sample PDF too
      if (normalizedSource.page_number && typeof normalizedSource.page_number === 'number') {
        urlParams.push(`page=${normalizedSource.page_number}`);
      }

      // Add search terms for highlighting
      if (normalizedSource.chunk_text && typeof normalizedSource.chunk_text === 'string') {
        const searchTerms = extractSearchTerms(normalizedSource.chunk_text);
        if (searchTerms.length > 0) {
          const searchQuery = searchTerms.slice(0, 2).join(' ');
          urlParams.push(`search=${encodeURIComponent(searchQuery)}`);
        }
      }

      // Append URL parameters
      if (urlParams.length > 0) {
        samplePdfUrl = `${samplePdfUrl}#${urlParams.join('&')}`;
      }

      try {
        const canOpen = await Linking.canOpenURL(samplePdfUrl);
        if (canOpen) {
          await Linking.openURL(samplePdfUrl);
        } else {
          Alert.alert('Error', 'Unable to open PDF viewer');
        }
      } catch (error) {
        console.error('Error opening sample PDF:', error);
        Alert.alert('Error', 'Failed to open PDF viewer');
      }
    }
  };

  const canViewPDF = (normalizedSource.pdf_url && normalizedSource.pdf_id) || onPDFView || true; // Always show for demo

  return (
    <View style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceName}>{normalizedSource.manual_name}</Text>
          {normalizedSource.page_number && (
            <Text style={styles.pageNumber}>Page {normalizedSource.page_number}</Text>
          )}
        </View>

        {normalizedSource.score && (
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              {Math.round(normalizedSource.score * 100)}%
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.sourceText} numberOfLines={3}>
        {normalizedSource.chunk_text}
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
  errorText: {
    fontSize: 12,
    color: '#CC0000',
    textAlign: 'center',
    padding: 8,
  },
});
