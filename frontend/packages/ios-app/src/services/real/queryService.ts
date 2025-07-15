import { QueryService } from '../interfaces';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from './errorHandler';

class QueryApi extends BaseApi {
  async textQuery(question: string) {
    return this.post(API_ENDPOINTS.QUERY.ASK, { question });
  }

  async voiceQuery(audioBlob: Blob, contentType: string, includeSources = true) {
    console.log('Converting blob to base64 for API, blob size:', audioBlob.size);

    // Convert blob to base64 for API - React Native compatible approach
    try {
      // Try React Native method first
      const arrayBuffer = await audioBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64 = btoa(binaryString);

      console.log('Successfully converted blob to base64, length:', base64.length);

      return this.post(API_ENDPOINTS.QUERY.ASK, {
        question: '', // Will be filled by transcription
        file_data: base64,
        content_type: contentType,
        include_sources: includeSources,
      });
    } catch (error) {
      console.error('Failed to convert blob to base64:', error);

      // Fallback to FileReader for web compatibility
      console.log('Falling back to FileReader approach');
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
        question: '', // Will be filled by transcription
        file_data: base64,
        content_type: contentType,
        include_sources: includeSources,
      });
    }
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

  async voiceQuery(audioInput: Blob | { audioBlob: Blob | null; audioUri: string | null }, options?: any) {
    try {
      console.log('voiceQuery called with input:', audioInput);

      // Handle both Blob and AudioRecordingResult inputs
      let audioBlob: Blob;
      let contentType: string;

      if (audioInput instanceof Blob) {
        // Direct blob input (for web compatibility)
        audioBlob = audioInput;
        contentType = audioBlob.type || 'audio/wav';
        console.log('Using direct blob input, size:', audioBlob.size, 'type:', contentType);
      } else {
        // AudioRecordingResult from React Native
        console.log('AudioRecordingResult - audioBlob:', !!audioInput.audioBlob, 'audioUri:', audioInput.audioUri);
        if (audioInput.audioBlob) {
          audioBlob = audioInput.audioBlob;
          contentType = audioBlob.type || 'audio/mp4';
          console.log('Using audioBlob from result, size:', audioBlob.size, 'type:', contentType);
        } else if (audioInput.audioUri) {
          // Fallback: try to convert audioUri to blob
          console.log('No audioBlob available, attempting to convert audioUri to blob');
          try {
            const { FileSystem } = await import('expo-file-system');
            const base64 = await FileSystem.readAsStringAsync(audioInput.audioUri, {
              encoding: FileSystem.EncodingType.Base64,
            });

            // Convert base64 to blob
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            audioBlob = new Blob([bytes], { type: 'audio/mp4' });
            contentType = 'audio/mp4';
            console.log('Successfully converted audioUri to blob, size:', audioBlob.size);
          } catch (conversionError) {
            console.error('Failed to convert audioUri to blob:', conversionError);
            throw new Error('Failed to process audio file for upload');
          }
        } else {
          console.error('No audio blob or URI available in recording result');
          throw new Error('No audio data available from recording');
        }
      }

      console.log('Calling API voiceQuery with blob size:', audioBlob.size);
      const response = await this.api.voiceQuery(audioBlob, contentType, options?.includeSources !== false);
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
