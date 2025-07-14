import { Alert } from 'react-native';
import Toast from 'react-native-toast-message';

export interface ManuelError extends Error {
  type: 'rate_limit' | 'auth' | 'validation' | 'network' | 'server' | 'unknown';
  originalError?: any;
  retryAfter?: number;
  userMessage: string;
  technicalMessage: string;
}

export function createManuelError(
  type: ManuelError['type'],
  userMessage: string,
  technicalMessage: string,
  originalError?: any,
  retryAfter?: number
): ManuelError {
  const error = new Error(userMessage) as ManuelError;
  error.type = type;
  error.userMessage = userMessage;
  error.technicalMessage = technicalMessage;
  error.originalError = originalError;
  error.retryAfter = retryAfter;
  return error;
}

export function handleApiError(error: any, context: string = 'API call'): ManuelError {
  // Rate limiting (429 errors)
  if (error?.response?.status === 429) {
    const retryAfter = Math.max(
      parseInt(error.response?.headers?.['retry-after'] || '0', 10),
      error.response?.data?.retry_after || 60
    );

    return createManuelError(
      'rate_limit',
      `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
      `Rate limit exceeded for ${context}`,
      error,
      retryAfter
    );
  }

  // Authentication errors (401, 403)
  if (error?.response?.status === 401) {
    return createManuelError(
      'auth',
      'Your session has expired. Please log in again.',
      `Authentication failed for ${context}`,
      error
    );
  }

  if (error?.response?.status === 403) {
    return createManuelError(
      'auth',
      'Access denied. You may not have permission for this action.',
      `Authorization failed for ${context}`,
      error
    );
  }

  // Validation errors (400)
  if (error?.response?.status === 400) {
    const message = error.response?.data?.error || error.response?.data?.message;
    if (message?.includes('Invalid input detected')) {
      return createManuelError(
        'validation',
        'Invalid input detected. Please check your data and try again.',
        `Input validation failed for ${context}: ${message}`,
        error
      );
    }

    if (message?.includes('Request size exceeds')) {
      return createManuelError(
        'validation',
        'File or request too large. Please try with a smaller file.',
        `Request size limit exceeded for ${context}`,
        error
      );
    }

    return createManuelError(
      'validation',
      message || 'Invalid request. Please check your input and try again.',
      `Bad request for ${context}`,
      error
    );
  }

  // Network/timeout errors
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
    return createManuelError(
      'network',
      'Request timed out. Please check your internet connection and try again.',
      `Network timeout for ${context}`,
      error
    );
  }

  if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
    return createManuelError(
      'network',
      'Network error. Please check your internet connection and try again.',
      `Network error for ${context}`,
      error
    );
  }

  // Server errors (5xx)
  if (error?.response?.status >= 500) {
    return createManuelError(
      'server',
      'Server error. Please try again in a few moments.',
      `Server error ${error.response.status} for ${context}`,
      error
    );
  }

  // Unknown errors
  const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
  return createManuelError(
    'unknown',
    'Something went wrong. Please try again.',
    `Unknown error for ${context}: ${errorMessage}`,
    error
  );
}

export function showErrorToUser(error: ManuelError, fallbackTitle: string = 'Error') {
  switch (error.type) {
    case 'rate_limit':
      Toast.show({
        type: 'info',
        text1: '⏱️ Rate Limited',
        text2: error.userMessage,
        visibilityTime: 5000,
      });
      break;

    case 'auth':
      Alert.alert(
        '🔐 Authentication Required',
        error.userMessage,
        [{ text: 'OK' }]
      );
      break;

    case 'validation':
      Toast.show({
        type: 'error',
        text1: '⚠️ Invalid Input',
        text2: error.userMessage,
        visibilityTime: 4000,
      });
      break;

    case 'network':
      Toast.show({
        type: 'error',
        text1: '🌐 Connection Issue',
        text2: error.userMessage,
        visibilityTime: 4000,
      });
      break;

    case 'server':
      Toast.show({
        type: 'error',
        text1: '🔧 Server Issue',
        text2: error.userMessage,
        visibilityTime: 4000,
      });
      break;

    default:
      Alert.alert(
        fallbackTitle,
        error.userMessage,
        [{ text: 'OK' }]
      );
      break;
  }
}

export function shouldRetryError(error: ManuelError): boolean {
  return error.type === 'rate_limit' || error.type === 'network';
}

export function getRetryDelay(error: ManuelError): number {
  if (error.type === 'rate_limit' && error.retryAfter) {
    return error.retryAfter * 1000; // Convert to milliseconds
  }
  if (error.type === 'network') {
    return 2000; // 2 second delay for network retries
  }
  return 0;
}
