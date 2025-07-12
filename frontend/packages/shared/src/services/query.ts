import { apiService } from './api';
import {
  QueryRequest,
  QueryResponse,
  ApiResponse,
} from '../types';

class QueryService {
  // Send text query
  async textQuery(query: string, includeSources = true): Promise<QueryResponse> {
    const request: QueryRequest = {
      query,
      include_sources: includeSources,
    };

    const response = await apiService.post<ApiResponse<QueryResponse>>(
      '/api/query',
      request
    );
    return response.data!;
  }

  // Send voice query
  async voiceQuery(
    audioData: string,
    contentType: string,
    includeSources = true
  ): Promise<QueryResponse> {
    const request: QueryRequest = {
      query: '', // Will be filled by transcription
      file_data: audioData,
      content_type: contentType,
      include_sources: includeSources,
    };

    const response = await apiService.post<ApiResponse<QueryResponse>>(
      '/api/query',
      request
    );
    return response.data!;
  }

  // Get query suggestions (placeholder for future implementation)
  async getQuerySuggestions(partial: string): Promise<string[]> {
    // This could be implemented later to provide smart query suggestions
    // based on available manuals and common queries
    const suggestions = [
      `How to ${partial}`,
      `What is ${partial}`,
      `${partial} instructions`,
      `${partial} troubleshooting`,
      `${partial} setup`,
    ];

    return suggestions.filter(s =>
      s.toLowerCase().includes(partial.toLowerCase()) && partial.length > 2
    ).slice(0, 5);
  }
}

export const queryService = new QueryService();
