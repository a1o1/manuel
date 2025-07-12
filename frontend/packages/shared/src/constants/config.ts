// API Configuration
export const API_CONFIG = {
  BASE_URL: __DEV__
    ? 'https://your-dev-api-gateway-url.execute-api.eu-west-1.amazonaws.com'
    : 'https://your-prod-api-gateway-url.execute-api.eu-west-1.amazonaws.com',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

// AWS Cognito Configuration
export const COGNITO_CONFIG = {
  USER_POOL_ID: 'eu-west-1_xxxxxxxxx', // Replace with actual User Pool ID
  CLIENT_ID: 'xxxxxxxxxxxxxxxxxxxxxxxxxx', // Replace with actual Client ID
  REGION: 'eu-west-1',
  IDENTITY_POOL_ID: 'eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', // Replace with actual Identity Pool ID
};

// Audio Configuration
export const AUDIO_CONFIG = {
  SAMPLE_RATE: 44100,
  CHANNELS: 1,
  BIT_DEPTH: 16,
  MAX_DURATION: 300, // 5 minutes in seconds
  FORMAT: 'wav',
  QUALITY: 'high' as const,
};

// File Upload Configuration
export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB in bytes
  ALLOWED_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/html',
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.txt', '.md', '.html', '.htm'],
};

// App Configuration
export const APP_CONFIG = {
  NAME: 'Manuel',
  VERSION: '1.0.0',
  BUILD_NUMBER: 1,
  STORE_URL: {
    ios: 'https://apps.apple.com/app/manuel/id123456789',
    android: 'https://play.google.com/store/apps/details?id=com.manuel.app',
  },
  SUPPORT_EMAIL: 'support@manuel.com',
  PRIVACY_URL: 'https://manuel.com/privacy',
  TERMS_URL: 'https://manuel.com/terms',
};

// Feature Flags
export const FEATURES = {
  VOICE_RECORDING: true,
  FILE_UPLOAD: true,
  URL_DOWNLOAD: true,
  USAGE_ANALYTICS: true,
  PUSH_NOTIFICATIONS: false, // Not implemented yet
  OFFLINE_MODE: false, // Not implemented yet
};

// UI Constants
export const UI_CONSTANTS = {
  HEADER_HEIGHT: 60,
  TAB_BAR_HEIGHT: 80,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  TOAST_DURATION: 3000,
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKENS: '@manuel:auth_tokens',
  USER_DATA: '@manuel:user_data',
  SETTINGS: '@manuel:settings',
  QUERY_HISTORY: '@manuel:query_history',
  LAST_SESSION: '@manuel:last_session',
} as const;
