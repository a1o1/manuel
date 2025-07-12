"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = void 0;
const api_1 = require("./api");
class UsageService {
    // Get current usage statistics
    async getUsageStats() {
        const response = await api_1.apiService.get('/api/usage');
        return response.data;
    }
    // Get usage for a specific date range
    async getUsageHistory(startDate, endDate) {
        const response = await api_1.apiService.get(`/api/usage/history?start=${startDate}&end=${endDate}`);
        return response.data;
    }
    // Get cost breakdown
    async getCostBreakdown(period = 'daily') {
        const response = await api_1.apiService.get(`/api/usage/costs?period=${period}`);
        return response.data;
    }
    // Get quota limits
    async getQuotaLimits() {
        const response = await api_1.apiService.get('/api/usage/quotas');
        return response.data;
    }
    // Get recent query history
    async getRecentQueries(limit = 10) {
        const response = await api_1.apiService.get(`/api/usage/recent?limit=${limit}`);
        return response.data?.queries || [];
    }
    // Export usage data
    async exportUsageData(startDate, endDate, format = 'csv') {
        const response = await api_1.apiService.get(`/api/usage/export?start=${startDate}&end=${endDate}&format=${format}`, { responseType: 'blob' });
        return response;
    }
}
exports.usageService = new UsageService();
//# sourceMappingURL=usage.js.map