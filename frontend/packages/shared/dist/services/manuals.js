"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualService = void 0;
const api_1 = require("./api");
class ManualService {
    // Get all manuals
    async getManuals() {
        const response = await api_1.apiService.get('/api/manuals');
        // Backend returns data directly, not wrapped in ApiResponse
        return response || { manuals: [], count: 0 };
    }
    // Upload manual file
    async uploadManual(request) {
        const response = await api_1.apiService.post('/api/manuals/upload', request);
        return response.data;
    }
    // Download manual from URL
    async downloadManual(request) {
        const response = await api_1.apiService.post('/api/manuals/download', request);
        return response.data;
    }
    // Upload manual from URL (alias for downloadManual for clarity)
    async uploadFromUrl(url, filename) {
        return this.downloadManual({ url, filename });
    }
    // Delete manual
    async deleteManual(key) {
        await api_1.apiService.delete(`/api/manuals/${encodeURIComponent(key)}`);
    }
    // Get manual metadata
    async getManualMetadata(key) {
        const response = await api_1.apiService.get(`/api/manuals/${encodeURIComponent(key)}/metadata`);
        return response.data;
    }
    // Check processing status
    async getProcessingStatus(key) {
        const response = await api_1.apiService.get(`/api/manuals/${encodeURIComponent(key)}/status`);
        return response.data;
    }
}
exports.manualService = new ManualService();
//# sourceMappingURL=manuals.js.map
