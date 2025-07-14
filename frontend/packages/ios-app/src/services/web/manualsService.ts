import { ManualsService } from '../index';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from '../real/errorHandler';

class ManualsApi extends BaseApi {
  async getManuals() {
    return this.get(API_ENDPOINTS.MANUALS.LIST);
  }

  async uploadManual(file: File) {
    // Convert file to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(file);
    });

    return this.post(API_ENDPOINTS.MANUALS.UPLOAD, {
      filename: file.name,
      content: base64,
      content_type: file.type || 'application/pdf',
    });
  }

  async deleteManual(id: string) {
    return this.delete(`${API_ENDPOINTS.MANUALS.DELETE}/${id}`);
  }

  async downloadFromUrl(url: string, customName?: string) {
    return this.post(API_ENDPOINTS.MANUALS.DOWNLOAD, {
      url,
      filename: customName, // Use 'filename' to match CLI format
    });
  }
}

export class WebManualsService implements ManualsService {
  private api = new ManualsApi();

  async getManuals() {
    try {
      const response = await this.api.getManuals();

      if (response.error) {
        throw new Error(response.error);
      }

      // Return the raw API response data since CLI expects { manuals: Manual[], count: number }
      console.log('Raw manuals API response:', response.data);

      // If the response is the expected format, return it directly
      if (response.data && typeof response.data === 'object') {
        return response.data;
      }

      // Fallback if format is unexpected
      return { manuals: [], count: 0 };
    } catch (error) {
      console.error('Error getting manuals:', error);
      throw handleApiError(error, 'get manuals');
    }
  }

  async uploadManual(file: File) {
    try {
      const response = await this.api.uploadManual(file);

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'upload manual');
    }
  }

  async deleteManual(id: string) {
    try {
      const response = await this.api.deleteManual(id);

      if (response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      throw handleApiError(error, 'delete manual');
    }
  }

  async getManualDetail(id: string) {
    try {
      const manuals = await this.getManuals();
      return manuals.find(m => m.id === id) || null;
    } catch (error) {
      throw handleApiError(error, 'get manual detail');
    }
  }

  async uploadFromUrl(url: string, customName?: string) {
    try {
      console.log('WebManualsService.uploadFromUrl called with:', url, customName);
      const response = await this.api.downloadFromUrl(url, customName);
      console.log('API response:', response);

      if (response.error) {
        console.error('API returned error:', response.error);
        throw new Error(response.error);
      }

      console.log('Upload successful, returning:', response.data);
      return response.data;
    } catch (error) {
      console.error('uploadFromUrl error:', error);
      throw handleApiError(error, 'upload from URL');
    }
  }
}
