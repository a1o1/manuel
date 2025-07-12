"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryService = void 0;
const api_1 = require("./api");
class QueryService {
    // Send text query
    async textQuery(query, includeSources = true) {
        const request = {
            query,
            include_sources: includeSources,
        };
        const response = await api_1.apiService.post('/api/query', request);
        return response.data;
    }
    // Send voice query
    async voiceQuery(audioData, contentType, includeSources = true) {
        const request = {
            query: '', // Will be filled by transcription
            file_data: audioData,
            content_type: contentType,
            include_sources: includeSources,
        };
        const response = await api_1.apiService.post('/api/query', request);
        return response.data;
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