import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from './errorHandler';

export interface PDFPageRequest {
  pdf_url: string;
  page_number: number;
  highlight_text?: string;
  highlight_color?: 'yellow' | 'blue' | 'green' | 'red';
}

export interface PDFPageResponse {
  page_image_url: string;
  page_number: number;
  highlight_text?: string;
  highlight_color?: string;
  cached: boolean;
  processing_time_ms: number;
}

class PDFApi extends BaseApi {
  async extractPage(request: PDFPageRequest) {
    return this.post(API_ENDPOINTS.PDF.PAGE, request, 30000); // 30 second timeout
  }
}

export class RealPDFService {
  private api = new PDFApi();

  async extractPage(request: PDFPageRequest): Promise<PDFPageResponse> {
    try {
      const response = await this.api.extractPage(request);

      if (response.error) {
        throw new Error(response.error);
      }

      // The backend returns the response data directly
      const backendData = response.data || response;

      return {
        page_image_url: backendData.page_image_url,
        page_number: backendData.page_number,
        highlight_text: backendData.highlight_text,
        highlight_color: backendData.highlight_color,
        cached: backendData.cached || false,
        processing_time_ms: backendData.processing_time_ms || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'PDF page extraction');
    }
  }
}
