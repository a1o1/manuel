import { useState, useCallback } from 'react';
import { ManuelError, shouldRetryError, getRetryDelay } from '../services/real/errorHandler';
import { isAutomaticRetryEnabled } from '../config/environment';

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  maxRetries: number;
  nextRetryIn: number;
}

interface UseRetryRequestOptions {
  maxRetries?: number;
  onRetryStart?: (retryCount: number) => void;
  onRetryEnd?: (success: boolean, error?: ManuelError) => void;
}

export function useRetryRequest<T>(
  requestFn: () => Promise<T>,
  options: UseRetryRequestOptions = {}
) {
  const { maxRetries = 3, onRetryStart, onRetryEnd } = options;

  const [retryState, setRetryState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    maxRetries,
    nextRetryIn: 0,
  });

  const executeWithRetry = useCallback(async (): Promise<T> => {
    let lastError: ManuelError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setRetryState(prev => ({ ...prev, isRetrying: true, retryCount: attempt }));
          onRetryStart?.(attempt);
        }

        const result = await requestFn();

        if (attempt > 0) {
          setRetryState(prev => ({ ...prev, isRetrying: false }));
          onRetryEnd?.(true);
        }

        return result;
      } catch (error) {
        lastError = error as ManuelError;

        // Check if we should retry this error
        if (!isAutomaticRetryEnabled() || !shouldRetryError(lastError) || attempt >= maxRetries) {
          if (attempt > 0) {
            setRetryState(prev => ({ ...prev, isRetrying: false }));
            onRetryEnd?.(false, lastError);
          }
          throw lastError;
        }

        // Calculate delay and wait before retrying
        const delay = getRetryDelay(lastError);
        if (delay > 0) {
          setRetryState(prev => ({ ...prev, nextRetryIn: delay / 1000 }));

          // Countdown timer
          for (let i = Math.floor(delay / 1000); i > 0; i--) {
            setRetryState(prev => ({ ...prev, nextRetryIn: i }));
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Maximum retries exceeded');
  }, [requestFn, maxRetries, onRetryStart, onRetryEnd]);

  const reset = useCallback(() => {
    setRetryState({
      isRetrying: false,
      retryCount: 0,
      maxRetries,
      nextRetryIn: 0,
    });
  }, [maxRetries]);

  return {
    executeWithRetry,
    retryState,
    reset,
  };
}

// Hook specifically for rate-limited requests
export function useRateLimitedRequest<T>(
  requestFn: () => Promise<T>,
  options: UseRetryRequestOptions = {}
) {
  return useRetryRequest(requestFn, {
    maxRetries: 2, // Only retry rate limits a couple times
    ...options,
  });
}

// Hook for query requests with enhanced retry logic
export function useQueryRequest<T>(
  requestFn: () => Promise<T>,
  options: UseRetryRequestOptions = {}
) {
  const [isLoading, setIsLoading] = useState(false);

  const retryHook = useRetryRequest(requestFn, {
    maxRetries: 3,
    onRetryStart: (retryCount) => {
      options.onRetryStart?.(retryCount);
    },
    onRetryEnd: (success, error) => {
      setIsLoading(false);
      options.onRetryEnd?.(success, error);
    },
    ...options,
  });

  const execute = useCallback(async (): Promise<T> => {
    setIsLoading(true);
    try {
      const result = await retryHook.executeWithRetry();
      setIsLoading(false);
      return result;
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  }, [retryHook.executeWithRetry]);

  return {
    execute,
    isLoading,
    retryState: retryHook.retryState,
    reset: retryHook.reset,
  };
}
