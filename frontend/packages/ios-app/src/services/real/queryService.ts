import { QueryService } from '../interfaces';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from './errorHandler';

class QueryApi extends BaseApi {
  async textQuery(question: string) {
    return this.post(API_ENDPOINTS.QUERY.ASK, { question });
  }

  async voiceQuery(audioBlob: Blob, contentType: string) {
    // Convert blob to base64 for API
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read audio blob'));
      reader.readAsDataURL(audioBlob);
    });

    return this.post(API_ENDPOINTS.QUERY.ASK, {
      file_data: base64,
      content_type: contentType,
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

  async voiceQuery(audioBlob: Blob, options?: any) {
    try {
      const contentType = audioBlob.type || 'audio/wav';
      const response = await this.api.voiceQuery(audioBlob, contentType);

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
