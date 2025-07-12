"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryService = void 0;
const api_1 = require("./api");
class QueryService {
    // Send text query
    async textQuery(query, includeSources = true) {
        const request = {
            question: query, // Backend expects 'question', not 'query'
            include_sources: includeSources,
        };
        const response = await api_1.apiService.post('/api/query', request);
        // Backend returns 'answer' but frontend expects 'response'
        // Map the backend response to frontend format
        return {
            response: response.answer || response.response || '',
            sources: response.sources || [],
            usage: response.usage,
            costs: response.costs,
            processing_time_ms: response.processing_time_ms,
        };
    }
    // Send voice query
    async voiceQuery(audioData, contentType, includeSources = true) {
        const request = {
            question: '', // Will be filled by transcription
            file_data: audioData,
            content_type: contentType,
            include_sources: includeSources,
        };
        const response = await api_1.apiService.post('/api/query', request);
        // Backend returns 'answer' but frontend expects 'response'
        // Map the backend response to frontend format
        return {
            response: response.answer || response.response || '',
            sources: response.sources || [],
            usage: response.usage,
            costs: response.costs,
            processing_time_ms: response.processing_time_ms,
        };
    }
    // Get query suggestions (placeholder for future implementation)
    async getQuerySuggestions(partial) {
        // This could be implemented later to provide smart query suggestions
        // based on available manuals and common queries
        const suggestions = [
            `How to ${partial}`,
            `What is ${partial}`,
            `${partial} instructions`,
            `${partial} troubleshooting`,
            `${partial} setup`,
        ];
        return suggestions.filter(s => s.toLowerCase().includes(partial.toLowerCase()) && partial.length > 2).slice(0, 5);
    }
}
exports.queryService = new QueryService();
//# sourceMappingURL=query.js.map
