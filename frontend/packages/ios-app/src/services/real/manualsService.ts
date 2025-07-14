// Real manuals service using direct API calls for React Native
import { ManualsService } from '../interfaces';
import * as FileSystem from 'expo-file-system';

const API_BASE_URL = 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod';

export class RealManualsService implements ManualsService {
  private async getAuthHeaders() {
    // For now, return empty headers - will implement proper auth later
    throw new Error('Authentication not implemented - use mock mode');
  }

  async listManuals() {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/manuals`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.manuals || [];
    } catch (error: any) {
      console.error('List manuals error:', error);
      throw new Error(error.message || 'Failed to fetch manuals');
    }
  }

  async uploadManual(file: any, metadata: any) {
    try {
      const headers = await this.getAuthHeaders();
      
      // First, get the file info and read as base64
      const fileInfo = await FileSystem.getInfoAsync(file.uri);
      if (!fileInfo.exists) {
        throw new Error('File not found');
      }

      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const uploadData = {
        fileName: file.name || 'manual.pdf',
        fileContent: fileContent,
        contentType: file.type || 'application/pdf',
        metadata: {
          title: metadata.title || file.name,
          description: metadata.description || '',
          category: metadata.category || 'General',
          ...metadata,
        },
      };

      const response = await fetch(`${API_BASE_URL}/manuals/upload`, {
        method: 'POST',
        headers,
        body: JSON.stringify(uploadData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Upload manual error:', error);
      throw new Error(error.message || 'Failed to upload manual');
    }
  }

  async deleteManual(manualId: string) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/manuals/${manualId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Delete manual error:', error);
      throw new Error(error.message || 'Failed to delete manual');
    }
  }

  async downloadManual(manualId: string) {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/manuals/${manualId}/download`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Result should contain a presigned URL for download
      if (result.downloadUrl) {
        return result.downloadUrl;
      } else {
        throw new Error('Download URL not provided');
      }
    } catch (error: any) {
      console.error('Download manual error:', error);
      throw new Error(error.message || 'Failed to download manual');
    }
  }
}