export * from './storage';
export * from './validation';
export * from './formatting';

// Error handling utilities
export const handleApiError = (error: any): string => {
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

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Platform detection
export const isIOS = (() => {
  try {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
           require('react-native').Platform.OS === 'ios';
  } catch {
    return false;
  }
})();

export const isAndroid = (() => {
  try {
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
           require('react-native').Platform.OS === 'android';
  } catch {
    return false;
  }
})();

// Safe area helpers
export const getStatusBarHeight = (): number => {
  if (isIOS) {
    return 44; // Default iOS status bar height
  }
  return 24; // Default Android status bar height
};

// Color utilities
export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Array utilities
export const groupBy = <T, K extends keyof any>(
  array: T[],
  getKey: (item: T) => K
): Record<K, T[]> => {
  return array.reduce((groups, item) => {
    const key = getKey(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<K, T[]>);
};

// Sleep utility
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Rate limiting utilities
export const isRateLimitError = (error: any): boolean => {
  return error?.response?.status === 429;
};

export const getRateLimitRetryAfter = (error: any): number => {
  if (!isRateLimitError(error)) return 0;

  // Check retry-after header first, then response data
  const headerRetryAfter = parseInt(error.response?.headers?.['retry-after'] || '0', 10);
  const dataRetryAfter = error.response?.data?.retry_after || 60;

  return Math.max(headerRetryAfter, dataRetryAfter);
};

// Security error detection utilities
export const isSecurityError = (error: any): boolean => {
  const status = error?.response?.status;
  const message = error?.response?.data?.error || error?.message || '';

  return (
    status === 403 || // Access denied
    status === 429 || // Rate limiting
    (status === 400 && (
      message.includes('Invalid input') ||
      message.includes('Input validation failed') ||
      message.includes('Request too large')
    ))
  );
};

// Exponential backoff utility
export const calculateBackoffDelay = (attempt: number, baseDelay: number = 1000, maxDelay: number = 30000): number => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};
