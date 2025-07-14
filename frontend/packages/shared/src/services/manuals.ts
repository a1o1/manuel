import { apiService } from './api';
import {
  Manual,
  ManualUploadRequest,
  ManualDownloadRequest,
  ManualUploadResponse,
  ApiResponse,
} from '../types';

class ManualService {
  // Get all manuals
  async getManuals(): Promise<{ manuals: Manual[]; count: number }> {
    const response = await apiService.get<{ manuals: Manual[]; count: number }>(
      '/api/manuals'
    );
    // Backend returns data directly, not wrapped in ApiResponse
    return response || { manuals: [], count: 0 };
  }

  // Upload manual file
  async uploadManual(request: ManualUploadRequest): Promise<ManualUploadResponse> {
    const response = await apiService.post<ApiResponse<ManualUploadResponse>>(
      '/api/manuals/upload',
      request
    );
    return response.data!;
  }

  // Download manual from URL
  async downloadManual(request: ManualDownloadRequest): Promise<ManualUploadResponse> {
    const response = await apiService.post<any>(
      '/api/manuals/download',
      request
    );

    console.log('[ManualService] downloadManual response:', response);

    // The backend returns data directly, not wrapped in ApiResponse
    if (response.data) {
      return response.data;
    } else {
      return response;
    }
  }

  // Upload manual from URL (alias for downloadManual for clarity)
  async uploadFromUrl(url: string, filename?: string): Promise<ManualUploadResponse> {
    return this.downloadManual({ url, filename });
  }
  // Delete manual
  async deleteManual(key: string): Promise<void> {
    await apiService.delete(`/api/manuals/${encodeURIComponent(key)}`);
  }

  // Get manual metadata
  async getManualMetadata(key: string): Promise<Manual> {
    const response = await apiService.get<ApiResponse<Manual>>(
      `/api/manuals/${encodeURIComponent(key)}/metadata`
    );
    return response.data!;
  }

  // Check processing status
  async getProcessingStatus(key: string): Promise<{
    status: string;
    job_id: string;
    created_at: string;
    updated_at: string;
  }> {
    const response = await apiService.get<ApiResponse<{
      status: string;
      job_id: string;
      created_at: string;
      updated_at: string;
    }>>(`/api/manuals/${encodeURIComponent(key)}/status`);
    return response.data!;
  }
}

export const manualService = new ManualService();
