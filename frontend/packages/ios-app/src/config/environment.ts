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
  },

  // Development settings
  DEV: {
    LOG_API_CALLS: true,
    SHOW_DEV_INDICATORS: true,
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
};

export const switchToMock = () => {
  ENV_CONFIG.MODE = 'mock';
  ENV_CONFIG.FEATURES.MOCK_AUTH = true;
  ENV_CONFIG.FEATURES.MOCK_USAGE = true;
  ENV_CONFIG.FEATURES.MOCK_QUERIES = true;
  ENV_CONFIG.FEATURES.MOCK_MANUALS = true;
};
