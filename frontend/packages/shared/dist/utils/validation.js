"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALIDATION_MESSAGES = exports.isValidPhoneNumber = exports.isValidQuery = exports.isValidUrl = exports.isValidFileSize = exports.isValidFileType = exports.isValidPassword = exports.isValidEmail = void 0;
// Email validation
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};
exports.isValidEmail = isValidEmail;
// Password validation
const isValidPassword = (password) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
};
exports.isValidPassword = isValidPassword;
// File validation
const isValidFileType = (fileName, allowedExtensions) => {
    const extension = fileName.toLowerCase().split('.').pop();
    return extension ? allowedExtensions.includes(`.${extension}`) : false;
};
exports.isValidFileType = isValidFileType;
const isValidFileSize = (size, maxSize) => {
    return size <= maxSize;
};
exports.isValidFileSize = isValidFileSize;
// URL validation
const isValidUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:';
    }
    catch {
        return false;
    }
};
exports.isValidUrl = isValidUrl;
// Query validation
const isValidQuery = (query) => {
    return query.trim().length >= 3 && query.trim().length <= 1000;
};
exports.isValidQuery = isValidQuery;
// Phone number validation (international format)
const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
};
exports.isValidPhoneNumber = isValidPhoneNumber;
// Validation error messages
exports.VALIDATION_MESSAGES = {
    EMAIL_INVALID: 'Please enter a valid email address',
    PASSWORD_WEAK: 'Password must be at least 8 characters with uppercase, lowercase, and number',
    PASSWORD_MISMATCH: 'Passwords do not match',
    REQUIRED_FIELD: 'This field is required',
    FILE_TYPE_INVALID: 'File type not supported',
    FILE_SIZE_INVALID: 'File size exceeds maximum limit',
    URL_INVALID: 'Please enter a valid HTTPS URL',
    QUERY_TOO_SHORT: 'Query must be at least 3 characters',
    QUERY_TOO_LONG: 'Query must be less than 1000 characters',
    PHONE_INVALID: 'Please enter a valid phone number',
};
//# sourceMappingURL=validation.js.map