// Environment configuration
export const ENV_CONFIG = {
  // Set to 'mock' for development, 'production' for real backend
  MODE: 'production' as 'mock' | 'production',

  // API endpoints for production
  API_BASE_URL: 'https://83bcch9z1c.execute-api.eu-west-1.amazonaws.com/Prod',

  // AWS Cognito configuration
  COGNITO: {
    USER_POOL_ID: 'eu-west-1_DQt2MDcmp',
    CLIENT_ID: '3ai5dri6105vaut9bie6ku5omb',
    REGION: 'eu-west-1',
    COGNITO_DOMAIN: 'https://cognito-idp.eu-west-1.amazonaws.com',
  },

  // CORS proxy for development (to bypass CORS issues)
  USE_CORS_PROXY: false,
  CORS_PROXY_URL: 'https://cors-anywhere.herokuapp.com/',

  // Feature flags
  FEATURES: {
    MOCK_AUTH: false,      // Use real authentication in production
    MOCK_USAGE: true,      // Keep usage as mock for now
    MOCK_QUERIES: false,   // Use real query service to connect to backend
    MOCK_MANUALS: false,   // Use real manuals service in production
    ENABLE_VOICE_RECORDING: true,
    ENABLE_FILE_UPLOAD: true,
    ENABLE_ENHANCED_ERROR_HANDLING: true,
    ENABLE_AUTOMATIC_RETRY: true,
  },

  // Security and rate limiting configuration
  SECURITY: {
    RATE_LIMIT: {
      REQUESTS_PER_WINDOW: 50,
      WINDOW_MINUTES: 15,
      MAX_RETRY_WAIT: 300, // seconds
    },
    API: {
      MAX_REQUEST_SIZE_MB: 50,
      TIMEOUT_MS: 30000,
      ENABLE_RETRY_ON_RATE_LIMIT: true,
    },
  },

  // Development settings
  DEV: {
    LOG_API_CALLS: true,   // Temporarily enabled for debugging voice queries
    SHOW_DEV_INDICATORS: true,
    LOG_ERRORS: true,      // Temporarily enabled for debugging voice queries
  }
};

// Helper functions
export const isProduction = () => ENV_CONFIG.MODE === 'production';
export const isMockMode = () => ENV_CONFIG.MODE === 'mock';
export const getApiUrl = (endpoint: string) => {
  // Use CORS proxy in development to bypass CORS issues
  if (ENV_CONFIG.USE_CORS_PROXY && typeof window !== 'undefined') {
    return `${ENV_CONFIG.CORS_PROXY_URL}${ENV_CONFIG.API_BASE_URL}${endpoint}`;
  }
  return `${ENV_CONFIG.API_BASE_URL}${endpoint}`;
};

// Easy toggle for switching modes
export const switchToProduction = () => {
  ENV_CONFIG.MODE = 'production';
  ENV_CONFIG.FEATURES.MOCK_AUTH = false;    // Real auth in production
  ENV_CONFIG.FEATURES.MOCK_USAGE = false;   // Real usage in production
  ENV_CONFIG.FEATURES.MOCK_QUERIES = false; // Real queries in production
  ENV_CONFIG.FEATURES.MOCK_MANUALS = false; // Real manuals in production
  ENV_CONFIG.FEATURES.ENABLE_ENHANCED_ERROR_HANDLING = true;
  ENV_CONFIG.FEATURES.ENABLE_AUTOMATIC_RETRY = true;
};

export const switchToMock = () => {
  ENV_CONFIG.MODE = 'mock';
  ENV_CONFIG.FEATURES.MOCK_AUTH = true;     // Mock auth in development
  ENV_CONFIG.FEATURES.MOCK_USAGE = true;
  ENV_CONFIG.FEATURES.MOCK_QUERIES = true;
  ENV_CONFIG.FEATURES.MOCK_MANUALS = true;
  ENV_CONFIG.FEATURES.ENABLE_ENHANCED_ERROR_HANDLING = false;
  ENV_CONFIG.FEATURES.ENABLE_AUTOMATIC_RETRY = false;
};

// Configuration helpers
export const getRateLimitConfig = () => ENV_CONFIG.SECURITY.RATE_LIMIT;
export const getApiConfig = () => ENV_CONFIG.SECURITY.API;
export const isEnhancedErrorHandlingEnabled = () => ENV_CONFIG.FEATURES.ENABLE_ENHANCED_ERROR_HANDLING;
export const isAutomaticRetryEnabled = () => ENV_CONFIG.FEATURES.ENABLE_AUTOMATIC_RETRY;
