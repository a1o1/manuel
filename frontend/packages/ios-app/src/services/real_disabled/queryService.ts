import { QueryService } from '../index';
import { queryService as sharedQueryService } from '@manuel/shared';
import { handleApiError } from './errorHandler';

export class RealQueryService implements QueryService {
  async textQuery(query: string, options?: any) {
    try {
      const response = await sharedQueryService.textQuery(query, options?.includeSources !== false);

      // Transform response to match iOS app interface
      return {
        answer: response.answer,
        sources: response.sources?.map(source => ({
          manual_name: this.extractManualName(source.metadata?.source || ''),
          page_number: source.metadata?.page_number,
          chunk_text: source.content || source.text
        })),
        cost: response.costs?.total_cost || 0,
        responseTime: response.response_time_ms || response.processing_time_ms || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'text query');
    }
  }

  async voiceQuery(audioBlob: Blob, options?: any) {
    try {
      // Convert Blob to base64 for voice query
      const audioBase64 = await this.blobToBase64(audioBlob);
      const contentType = audioBlob.type || 'audio/wav';

      const response = await sharedQueryService.voiceQuery(
        audioBase64,
        contentType,
        options?.includeSources !== false
      );

      // Transform response to match iOS app interface
      return {
        transcription: response.question || response.transcription || '',
        answer: response.answer,
        sources: response.sources?.map(source => ({
          manual_name: this.extractManualName(source.metadata?.source || ''),
          page_number: source.metadata?.page_number,
          chunk_text: source.content || source.text
        })),
        cost: response.costs?.total_cost || 0,
        responseTime: response.response_time_ms || response.processing_time_ms || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'voice query');
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result && typeof reader.result === 'string') {
          // Remove data URL prefix to get just the base64 data
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert audio to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private extractManualName(source: string): string {
    // Extract manual name from S3 URI or file path
    if (source.includes('/')) {
      const parts = source.split('/');
      const filename = parts[parts.length - 1];
      // Remove file extension and decode URI components
      return decodeURIComponent(filename.replace(/\.(pdf|txt|md)$/i, ''));
    }
    return source;
  }
}
