import { QueryService } from '../index';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from '../real/errorHandler';

class QueryApi extends BaseApi {
  async textQuery(question: string) {
    return this.post(API_ENDPOINTS.QUERY.ASK, { question });
  }

  async voiceQuery(audioBlob: Blob, contentType: string) {
    // Convert blob to base64 for API
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(audioBlob);
    });

    return this.post(API_ENDPOINTS.QUERY.ASK, {
      file_data: base64,
      content_type: contentType,
    });
  }
}

export class WebQueryService implements QueryService {
  private api = new QueryApi();

  async textQuery(query: string, options?: any) {
    try {
      const response = await this.api.textQuery(query);

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
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

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'voice query');
    }
  }
}
