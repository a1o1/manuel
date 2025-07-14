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
        // Create a clean object for serialization
        const cleanObj = Object.fromEntries(
          Object.entries(obj).filter(([key, value]) => {
            try {
              JSON.stringify(value);
              return true;
            } catch {
              return false;
            }
          })
        );
        return JSON.stringify(cleanObj, null, 2);
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