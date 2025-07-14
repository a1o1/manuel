import { logger } from '../../utils/logger';

// Enhanced error handler for iOS
export const handleApiError = (error: any, operation: string = 'API call') => {
  logger.error(`Error during ${operation}:`, error);

  // Handle network errors
  if (!error.response && error.message) {
    if (error.message.includes('Network request failed') || error.message.includes('fetch')) {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    }
  }

  // Handle API response errors
  if (error.response) {
    const status = error.response.status;
    const message = error.response.data?.error || error.response.data?.message || error.message;

    switch (status) {
      case 400:
        throw new Error(`Invalid request: ${message}`);
      case 401:
        throw new Error('Authentication failed. Please log in again.');
      case 403:
        throw new Error('Access denied. You do not have permission to perform this action.');
      case 404:
        throw new Error('The requested resource was not found.');
      case 429:
        throw new Error('Rate limit exceeded. Please wait a moment before trying again.');
      case 500:
        throw new Error('Server error. Please try again later.');
      case 503:
        throw new Error('Service temporarily unavailable. Please try again later.');
      default:
        throw new Error(`Request failed: ${message || `Error ${status}`}`);
    }
  }

  // Handle generic errors
  if (error.message) {
    // Check for specific error patterns
    if (error.message.includes('Rate limit exceeded')) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }

    if (error.message.includes('Invalid input detected')) {
      throw new Error('Invalid input detected. Please check your request and try again.');
    }

    if (error.message.includes('Access denied')) {
      throw new Error('Access denied. Please check your permissions or contact your administrator.');
    }

    throw new Error(error.message);
  }

  // Fallback error
  throw new Error(`Failed to ${operation}. Please try again.`);
};
