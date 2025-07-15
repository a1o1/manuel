import { QueryService } from '../interfaces';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from './errorHandler';

class QueryApi extends BaseApi {
  async textQuery(question: string) {
    return this.post(API_ENDPOINTS.QUERY.ASK, { question });
  }

  async voiceQuery(audioBase64: string, contentType: string, includeSources = true) {
    console.log('Sending audio data to API, base64 length:', audioBase64.length);
    console.log('Content type:', contentType);
    console.log('First 100 chars of base64:', audioBase64.substring(0, 100));

    return this.post(API_ENDPOINTS.QUERY.ASK, {
      question: '', // Will be filled by transcription
      file_data: audioBase64,
      content_type: contentType,
      include_sources: includeSources,
    });
  }
}

export class RealQueryService implements QueryService {
  private api = new QueryApi();

  private extractManualName(s3Uri: string): string {
    try {
      // Extract filename from S3 URI: s3://bucket/manuals/user/file.pdf -> file.pdf
      const parts = s3Uri.split('/');
      const filename = parts[parts.length - 1];

      // Remove file extension and decode URI components
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      return decodeURIComponent(nameWithoutExt).replace(/[-_]/g, ' ');
    } catch (error) {
      return 'Unknown Manual';
    }
  }

  async textQuery(query: string, options?: any) {
    try {
      const response = await this.api.textQuery(query);

      if (response.error) {
        throw new Error(response.error);
      }

      // Transform backend response to match expected format
      const { data } = response;

      // Transform sources from backend format to UI format
      const transformedSources = data.sources && options?.includeSources !== false
        ? data.sources.map((source: any) => ({
            manual_name: this.extractManualName(source.metadata?.source || ''),
            page_number: source.metadata?.page_number || null,
            chunk_text: source.content || '',
            score: source.metadata?.score || 0,
          }))
        : undefined;

      return {
        answer: data.answer || data.response,
        sources: transformedSources,
        cost: data.costs?.total_cost || 0,
        responseTime: data.processing_time_ms || 0,
        timestamp: data.timestamp,
        cacheStatus: data.cache_status,
        contextFound: data.context_found,
      };
    } catch (error) {
      throw handleApiError(error, 'query');
    }
  }

  async voiceQuery(audioInput: { audioUri: string | null }, options?: any) {
    try {
      console.log('voiceQuery called with audioUri:', audioInput.audioUri);

      // Get base64 data from audio URI
      let base64Data: string;
      let contentType: string;

      if (audioInput.audioUri) {
        // Use the URI directly to get base64 data
        console.log('Converting audioUri to base64 directly');
        try {
          const { FileSystem } = await import('expo-file-system');
          base64Data = await FileSystem.readAsStringAsync(audioInput.audioUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          contentType = 'audio/wav';

          console.log('Successfully converted audioUri to base64, length:', base64Data.length);
          console.log('First 50 chars of base64:', base64Data.substring(0, 50));
        } catch (conversionError) {
          console.error('Failed to convert audioUri to base64:', conversionError);
          throw new Error('Failed to process audio file for upload');
        }
      } else {
        console.error('No audio URI available in recording result');
        throw new Error('No audio data available from recording');
      }

      console.log('Calling API with base64 data, length:', base64Data.length);
      const response = await this.api.voiceQuery(base64Data, contentType, options?.includeSources !== false);
      console.log('API response received:', response);

      if (response.error) {
        throw new Error(response.error);
      }

      // Transform backend response to match expected format
      const { data } = response;

      // Transform sources from backend format to UI format
      const transformedSources = data.sources && options?.includeSources !== false
        ? data.sources.map((source: any) => ({
            manual_name: this.extractManualName(source.metadata?.source || ''),
            page_number: source.metadata?.page_number || null,
            chunk_text: source.content || '',
            score: source.metadata?.score || 0,
          }))
        : undefined;

      return {
        transcription: data.question, // Backend returns transcribed question
        answer: data.answer || data.response,
        sources: transformedSources,
        cost: data.costs?.total_cost || 0,
        responseTime: data.processing_time_ms || 0,
        timestamp: data.timestamp,
        cacheStatus: data.cache_status,
        contextFound: data.context_found,
      };
    } catch (error) {
      throw handleApiError(error, 'voice query');
    }
  }
}
