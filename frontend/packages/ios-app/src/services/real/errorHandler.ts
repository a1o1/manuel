// Stub error handler for iOS
export const handleApiError = (error: any) => {
  throw new Error(`API Error: ${error.message || 'Unknown error'}`);
};
