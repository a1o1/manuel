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
exports.sleep = exports.groupBy = exports.hexToRgba = exports.getStatusBarHeight = exports.isAndroid = exports.isIOS = exports.generateId = exports.throttle = exports.debounce = exports.handleApiError = void 0;
__exportStar(require("./storage"), exports);
__exportStar(require("./validation"), exports);
__exportStar(require("./formatting"), exports);
// Error handling utilities
const handleApiError = (error) => {
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
//# sourceMappingURL=index.js.map