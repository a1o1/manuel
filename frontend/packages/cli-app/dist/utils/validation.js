"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEmail = validateEmail;
exports.validatePassword = validatePassword;
exports.validateUrl = validateUrl;
exports.validateFilePath = validateFilePath;
// Email validation
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return 'Please enter a valid email address';
    }
    return true;
}
// Password validation
function validatePassword(password) {
    if (password.length < 8) {
        return 'Password must be at least 8 characters long';
    }
    if (!/(?=.*[a-z])/.test(password)) {
        return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
        return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
        return 'Password must contain at least one number';
    }
    return true;
}
// URL validation
function validateUrl(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== 'https:') {
            return 'Only HTTPS URLs are allowed';
        }
        return true;
    }
    catch {
        return 'Please enter a valid URL';
    }
}
// File path validation
function validateFilePath(path) {
    if (!path || path.trim().length === 0) {
        return 'Please enter a file path';
    }
    // Basic path validation
    if (path.includes('..')) {
        return 'Path traversal not allowed';
    }
    return true;
}
//# sourceMappingURL=validation.js.map