import { UsageService } from '../index';
import { BaseApi } from '../api/baseApi';
import { API_ENDPOINTS } from '../../constants/api';
import { handleApiError } from '../real/errorHandler';

class UsageApi extends BaseApi {
  async getUsage() {
    return this.get(API_ENDPOINTS.USAGE.GET);
  }
}

export class WebUsageService implements UsageService {
  private api = new UsageApi();

  async getUsage() {
    try {
      const response = await this.api.getUsage();

      if (response.error) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      throw handleApiError(error, 'get usage');
    }
  }

  async refreshUsage() {
    // Same as getUsage for web
    return this.getUsage();
  }
}
