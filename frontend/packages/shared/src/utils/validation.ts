// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// File validation
export const isValidFileType = (fileName: string, allowedExtensions: string[]): boolean => {
  const extension = fileName.toLowerCase().split('.').pop();
  return extension ? allowedExtensions.includes(`.${extension}`) : false;
};

export const isValidFileSize = (size: number, maxSize: number): boolean => {
  return size <= maxSize;
};

// URL validation
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Query validation
export const isValidQuery = (query: string): boolean => {
  return query.trim().length >= 3 && query.trim().length <= 1000;
};

// Phone number validation (international format)
export const isValidPhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

// Validation error messages
export const VALIDATION_MESSAGES = {
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
} as const;
