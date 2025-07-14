// Selective imports from shared package to avoid Node.js dependencies
// Only import what's needed for the iOS app

// Types
export type { User, Manual, UsageData, QueryResponse } from '@manuel/shared/dist/types';

// Constants
export { API_ENDPOINTS, ERROR_MESSAGES } from '@manuel/shared/dist/constants';

// Utils - only browser-compatible utilities
export {
  formatDate,
  formatBytes,
  formatDuration,
  getErrorMessage,
  isTokenExpired,
  calculateQuotaPercentage,
  isRateLimitError,
  getRetryAfter,
  isSecurityError,
  getErrorCategory
} from '@manuel/shared/dist/utils';

// Services will be imported from our real implementations
// that wrap the API calls without Node.js dependencies
