import { ENV_CONFIG } from '../config/environment';

// Safe logging utility that prevents PrettyFormatPluginError
class SafeLogger {
  private isDev = ENV_CONFIG.DEV.LOG_API_CALLS;

  private safeStringify(obj: any): string {
    try {
      if (obj === null || obj === undefined) {
        return String(obj);
      }

      if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj);
      }

      // Handle objects that might not have hasOwnProperty
      if (typeof obj === 'object') {
        // Use a safer approach that doesn't rely on hasOwnProperty
        try {
          // First try simple JSON stringify
          return JSON.stringify(obj, null, 2);
        } catch (jsonError) {
          // If that fails, create a simple object representation
          try {
            const safeObj: any = {};

            // Use Object.keys to avoid hasOwnProperty issues
            const keys = Object.keys(obj || {});
            for (const key of keys) {
              try {
                const value = obj[key];
                if (value !== undefined && typeof value !== 'function') {
                  safeObj[key] = typeof value === 'object' ? '[Object]' : String(value);
                }
              } catch {
                safeObj[key] = '[Inaccessible]';
              }
            }

            return JSON.stringify(safeObj, null, 2);
          } catch {
            return `[Object: ${obj.constructor?.name || 'Unknown'}]`;
          }
        }
      }

      return String(obj);
    } catch (error) {
      return `[Object could not be serialized: ${typeof obj}]`;
    }
  }

  log(...args: any[]) {
    if (this.isDev) {
      const safeArgs = args.map(arg =>
        typeof arg === 'object' ? this.safeStringify(arg) : arg
      );
      console.log(...safeArgs);
    }
  }

  error(...args: any[]) {
    if (this.isDev) {
      const safeArgs = args.map(arg =>
        typeof arg === 'object' ? this.safeStringify(arg) : arg
      );
      console.error(...safeArgs);
    }
  }

  warn(...args: any[]) {
    if (this.isDev) {
      const safeArgs = args.map(arg =>
        typeof arg === 'object' ? this.safeStringify(arg) : arg
      );
      console.warn(...safeArgs);
    }
  }
}

export const logger = new SafeLogger();
