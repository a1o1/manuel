import { ManualsService } from '../index';
import { manualsService as sharedManualsService } from '@manuel/shared';
import { handleApiError } from './errorHandler';

export class RealManualsService implements ManualsService {
  async getManuals() {
    try {
      const response = await sharedManualsService.listManuals();

      // Transform response to match iOS app interface
      return response.manuals?.map((manual: any) => ({
        id: manual.id || manual.manual_id,
        name: manual.name || manual.manual_name || manual.file_name,
        uploadDate: manual.upload_date || manual.created_at || new Date().toISOString().split('T')[0],
        pages: manual.pages || manual.page_count || 0,
        size: this.formatFileSize(manual.size || manual.file_size || 0),
        status: this.mapStatus(manual.status),
      })) || [];
    } catch (error) {
      throw handleApiError(error, 'get manuals');
    }
  }

  async uploadManual(file: File) {
    try {
      // For React Native, we'll need to handle file differently
      // But for now, let's create a FormData object
      const formData = new FormData();
      formData.append('file', file);

      const response = await sharedManualsService.uploadManual(formData);

      // Transform response to match iOS app interface
      return {
        id: response.manual_id || response.id,
        name: response.file_name || response.name || file.name,
        uploadDate: response.upload_date || new Date().toISOString().split('T')[0],
        pages: response.pages || 0,
        size: this.formatFileSize(file.size),
        status: this.mapStatus(response.status) as 'processing' | 'processed' | 'failed',
      };
    } catch (error) {
      throw handleApiError(error, 'upload manual');
    }
  }

  async deleteManual(id: string) {
    try {
      await sharedManualsService.deleteManual(id);
    } catch (error) {
      throw handleApiError(error, 'delete manual');
    }
  }

  async getManualDetail(id: string) {
    try {
      const response = await sharedManualsService.getManualDetail(id);

      // Transform response to match iOS app interface
      return {
        id: response.id || response.manual_id,
        name: response.name || response.manual_name || response.file_name,
        uploadDate: response.upload_date || response.created_at || new Date().toISOString().split('T')[0],
        pages: response.pages || response.page_count || 0,
        size: this.formatFileSize(response.size || response.file_size || 0),
        status: this.mapStatus(response.status),
        chunks: response.chunks || response.chunk_count || 0,
        lastQueried: response.last_queried || response.last_accessed,
        queryCount: response.query_count || response.access_count || 0,
      };
    } catch (error) {
      throw handleApiError(error, 'get manual detail');
    }
  }

  // Additional method for URL-based upload
  async uploadManualFromUrl(url: string, fileName?: string) {
    try {
      const response = await sharedManualsService.downloadManual(url, fileName);

      return {
        id: response.manual_id || response.id,
        name: response.file_name || response.name || fileName || 'Downloaded Manual',
        uploadDate: response.upload_date || new Date().toISOString().split('T')[0],
        pages: response.pages || 0,
        size: this.formatFileSize(response.size || 0),
        status: this.mapStatus(response.status) as 'processing' | 'processed' | 'failed',
      };
    } catch (error) {
      throw handleApiError(error, 'download manual from URL');
    }
  }

  // Get ingestion status
  async getIngestionStatus() {
    try {
      const response = await sharedManualsService.getIngestionStatus();
      return response;
    } catch (error) {
      throw handleApiError(error, 'get ingestion status');
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  private mapStatus(status: string): 'processing' | 'processed' | 'failed' {
    if (!status) return 'processing';

    const statusLower = status.toLowerCase();

    if (statusLower.includes('complete') || statusLower.includes('success') || statusLower === 'processed') {
      return 'processed';
    }

    if (statusLower.includes('fail') || statusLower.includes('error')) {
      return 'failed';
    }

    return 'processing';
  }
}
