"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBackoffDelay = exports.isSecurityError = exports.getRateLimitRetryAfter = exports.isRateLimitError = exports.sleep = exports.groupBy = exports.hexToRgba = exports.getStatusBarHeight = exports.isAndroid = exports.isIOS = exports.generateId = exports.throttle = exports.debounce = exports.handleApiError = void 0;
__exportStar(require("./storage"), exports);
__exportStar(require("./validation"), exports);
__exportStar(require("./formatting"), exports);
// Error handling utilities
const handleApiError = (error) => {
    // Handle rate limiting (429 errors)
    if (error?.response?.status === 429) {
        const retryAfter = error.response.data?.retry_after || 60;
        return `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
    }
    // Handle security violations (403 errors)
    if (error?.response?.status === 403) {
        if (error.response.data?.error?.includes('IP not allowed')) {
            return 'Access denied: Your IP address is not in the allowlist. Please contact your administrator.';
        }
        return error.response.data?.error || 'Access denied. Please check your network configuration.';
    }
    // Handle validation errors (400 errors with security context)
    if (error?.response?.status === 400 && error?.response?.data?.error) {
        const errorMsg = error.response.data.error;
        if (errorMsg.includes('Invalid input') || errorMsg.includes('Input validation failed')) {
            return 'Invalid input detected. Please check your request and try again.';
        }
        if (errorMsg.includes('Request too large')) {
            return 'Request size exceeds the maximum allowed limit. Please reduce the file size or content length.';
        }
        return errorMsg;
    }
    // Handle authentication errors (401 errors)
    if (error?.response?.status === 401) {
        return 'Authentication failed. Please log in again.';
    }
    // Handle timeout errors specifically
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        return 'Request timed out. Please check your connection and try again.';
    }
    // Handle network errors
    if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
        return 'Network error. Please check your internet connection.';
    }
    // Existing error handling for other cases
    if (error?.response?.data?.error) {
        return error.response.data.error;
    }
    if (error?.response?.data?.message) {
        return error.response.data.message;
    }
    if (error?.message) {
        return error.message;
    }
    return 'An unexpected error occurred';
};
exports.handleApiError = handleApiError;
// Debounce utility
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};
exports.debounce = debounce;
// Throttle utility
const throttle = (func, delay) => {
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
            lastCall = now;
            func(...args);
        }
    };
};
exports.throttle = throttle;
// Generate unique ID
const generateId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
exports.generateId = generateId;
// Platform detection
exports.isIOS = (() => {
    try {
        return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
            require('react-native').Platform.OS === 'ios';
    }
    catch {
        return false;
    }
})();
exports.isAndroid = (() => {
    try {
        return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
            require('react-native').Platform.OS === 'android';
    }
    catch {
        return false;
    }
})();
// Safe area helpers
const getStatusBarHeight = () => {
    if (exports.isIOS) {
        return 44; // Default iOS status bar height
    }
    return 24; // Default Android status bar height
};
exports.getStatusBarHeight = getStatusBarHeight;
// Color utilities
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
exports.hexToRgba = hexToRgba;
// Array utilities
const groupBy = (array, getKey) => {
    return array.reduce((groups, item) => {
        const key = getKey(item);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(item);
        return groups;
    }, {});
};
exports.groupBy = groupBy;
// Sleep utility
const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.sleep = sleep;
// Rate limiting utilities
const isRateLimitError = (error) => {
    return error?.response?.status === 429;
};
exports.isRateLimitError = isRateLimitError;
const getRateLimitRetryAfter = (error) => {
    if (!(0, exports.isRateLimitError)(error))
        return 0;
    // Check retry-after header first, then response data
    const headerRetryAfter = parseInt(error.response?.headers?.['retry-after'] || '0', 10);
    const dataRetryAfter = error.response?.data?.retry_after || 60;
    return Math.max(headerRetryAfter, dataRetryAfter);
};
exports.getRateLimitRetryAfter = getRateLimitRetryAfter;
// Security error detection utilities
const isSecurityError = (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.error || error?.message || '';
    return (status === 403 || // Access denied
        status === 429 || // Rate limiting
        (status === 400 && (message.includes('Invalid input') ||
            message.includes('Input validation failed') ||
            message.includes('Request too large'))));
};
exports.isSecurityError = isSecurityError;
// Exponential backoff utility
const calculateBackoffDelay = (attempt, baseDelay = 1000, maxDelay = 30000) => {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
};
exports.calculateBackoffDelay = calculateBackoffDelay;
//# sourceMappingURL=index.js.map