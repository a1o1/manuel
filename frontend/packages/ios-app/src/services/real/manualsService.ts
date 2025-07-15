// Real manuals service using direct API calls for React Native
import { ManualsService } from '../interfaces';
import { ENV_CONFIG, getApiUrl } from '../../config/environment';
import * as FileSystem from 'expo-file-system';
import { RealAuthService } from './authService';

export class RealManualsService implements ManualsService {
  private authService: RealAuthService;

  constructor() {
    this.authService = new RealAuthService();
  }

  private async getAuthHeaders() {
    try {
      const token = await this.authService.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available. Please sign in.');
      }

      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('Failed to get auth headers:', error);
      throw new Error('Authentication failed. Please sign in again.');
    }
  }

  async getManuals() {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(getApiUrl('/api/manuals'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.manuals || [];
    } catch (error: any) {
      console.error('Get manuals error:', error);
      throw new Error(error.message || 'Failed to fetch manuals');
    }
  }

  async uploadManual(file: any, metadata?: any) {
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
          title: metadata?.title || file.name,
          description: metadata?.description || '',
          category: metadata?.category || 'General',
          ...metadata,
        },
      };

      const response = await fetch(getApiUrl('/api/manuals/upload'), {
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
      const headers = {
        'Content-Type': 'application/json',
      };

      // URL encode the manual ID since it contains forward slashes
      const encodedManualId = encodeURIComponent(manualId);
      const response = await fetch(getApiUrl(`/api/manuals/${encodedManualId}`), {
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

  async getManualDetail(manualId: string) {
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // URL encode the manual ID since it contains forward slashes
      const encodedManualId = encodeURIComponent(manualId);
      const response = await fetch(getApiUrl(`/api/manuals/${encodedManualId}`), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Get manual detail error:', error);
      throw new Error(error.message || 'Failed to get manual details');
    }
  }

  async uploadFromUrl(url: string, customName?: string) {
    try {
      const headers = await this.getAuthHeaders();

      const uploadData = {
        url: url,
        filename: customName,
      };

      console.log('Uploading from URL:', uploadData);

      const response = await fetch(getApiUrl('/api/manuals/download'), {
        method: 'POST',
        headers,
        body: JSON.stringify(uploadData),
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        let errorData = {};
        let responseText = '';
        try {
          responseText = await response.text();
          console.log('Raw error response:', responseText);

          // Try to parse as JSON
          try {
            const parsedBody = JSON.parse(responseText);
            // The body might be wrapped in a "body" field from API Gateway
            if (parsedBody.body && typeof parsedBody.body === 'string') {
              errorData = JSON.parse(parsedBody.body);
            } else {
              errorData = parsedBody;
            }
          } catch (innerParseError) {
            console.error('Failed to parse nested JSON:', innerParseError);
            errorData = { message: responseText };
          }
        } catch (parseError) {
          console.error('Failed to read response text:', parseError);
          errorData = { message: 'Failed to read error response' };
        }

        console.error('Upload from URL failed - Full details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          responseText,
          url: url,
          filename: customName
        });

        // Extract the most relevant error message
        const errorMessage = errorData.error || errorData.message || errorData.details || responseText || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('Upload from URL success:', result);
      return result;
    } catch (error: any) {
      console.error('Upload from URL error:', error);
      throw new Error(error.message || 'Failed to upload from URL');
    }
  }
}
