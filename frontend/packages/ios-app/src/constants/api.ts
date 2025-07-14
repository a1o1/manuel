export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    LOGOUT: '/api/auth/logout',
    CONFIRM: '/api/auth/confirm',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
    CURRENT_USER: '/api/auth/current',
  },
  MANUALS: {
    LIST: '/api/manuals',
    UPLOAD: '/api/manuals/upload',
    DOWNLOAD: '/api/manuals/download',
    DELETE: '/api/manuals',
  },
  QUERY: {
    ASK: '/api/query',
  },
  USAGE: {
    GET: '/api/usage',
  },
  HEALTH: '/health',
};
