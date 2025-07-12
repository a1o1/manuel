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
    const response = await apiService.get<ApiResponse<{ manuals: Manual[]; count: number }>>(
      '/api/manuals'
    );
    return response.data || { manuals: [], count: 0 };
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
    const response = await apiService.post<ApiResponse<ManualUploadResponse>>(
      '/api/manuals/download',
      request
    );
    return response.data!;
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
