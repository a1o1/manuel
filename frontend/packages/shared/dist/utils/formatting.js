"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelToTitle = exports.capitalize = exports.truncateText = exports.formatPercentage = exports.formatNumber = exports.formatDuration = exports.formatCurrency = exports.formatFileSize = exports.formatRelativeTime = exports.formatDateTime = exports.formatDate = void 0;
// Date formatting
const formatDate = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};
exports.formatDate = formatDate;
const formatDateTime = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
exports.formatDateTime = formatDateTime;
const formatRelativeTime = (date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 1) {
        return 'Just now';
    }
    else if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }
    else if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    else if (diffDays < 7) {
        return `${diffDays}d ago`;
    }
    else {
        return (0, exports.formatDate)(dateObj);
    }
};
exports.formatRelativeTime = formatRelativeTime;
// File size formatting
const formatFileSize = (bytes) => {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
exports.formatFileSize = formatFileSize;
// Currency formatting
const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    }).format(amount);
};
exports.formatCurrency = formatCurrency;
// Duration formatting (for audio)
const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
exports.formatDuration = formatDuration;
// Number formatting
const formatNumber = (num) => {
    if (num >= 1000000) {
        return `${(num / 1000000).toFixed(1)}M`;
    }
    else if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
};
exports.formatNumber = formatNumber;
// Percentage formatting
const formatPercentage = (value, total) => {
    if (total === 0)
        return '0%';
    const percentage = (value / total) * 100;
    return `${Math.round(percentage)}%`;
};
exports.formatPercentage = formatPercentage;
// Text truncation
const truncateText = (text, maxLength) => {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength - 3)}...`;
};
exports.truncateText = truncateText;
// Capitalize first letter
const capitalize = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};
exports.capitalize = capitalize;
// Convert camelCase to Title Case
const camelToTitle = (text) => {
    return text
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
};
exports.camelToTitle = camelToTitle;
//# sourceMappingURL=formatting.js.map