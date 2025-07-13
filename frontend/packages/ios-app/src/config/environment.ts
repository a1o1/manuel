// Environment configuration
export const ENV_CONFIG = {
  // Set to 'mock' for development, 'production' for real backend
  MODE: 'mock' as 'mock' | 'production',

  // API endpoints for production
  API_BASE_URL: 'https://your-api-gateway-url.com/dev',

  // Feature flags
  FEATURES: {
    MOCK_AUTH: true,
    MOCK_USAGE: true,
    MOCK_QUERIES: true,
    MOCK_MANUALS: true,
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
    LOG_API_CALLS: true,
    SHOW_DEV_INDICATORS: true,
    LOG_ERRORS: true,
  }
};

// Helper functions
export const isProduction = () => ENV_CONFIG.MODE === 'production';
export const isMockMode = () => ENV_CONFIG.MODE === 'mock';
export const getApiUrl = (endpoint: string) =>
  `${ENV_CONFIG.API_BASE_URL}${endpoint}`;

// Easy toggle for switching modes
export const switchToProduction = () => {
  ENV_CONFIG.MODE = 'production';
  ENV_CONFIG.FEATURES.MOCK_AUTH = false;
  ENV_CONFIG.FEATURES.MOCK_USAGE = false;
  ENV_CONFIG.FEATURES.MOCK_QUERIES = false;
  ENV_CONFIG.FEATURES.MOCK_MANUALS = false;
  ENV_CONFIG.FEATURES.ENABLE_ENHANCED_ERROR_HANDLING = true;
  ENV_CONFIG.FEATURES.ENABLE_AUTOMATIC_RETRY = true;
};

export const switchToMock = () => {
  ENV_CONFIG.MODE = 'mock';
  ENV_CONFIG.FEATURES.MOCK_AUTH = true;
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
