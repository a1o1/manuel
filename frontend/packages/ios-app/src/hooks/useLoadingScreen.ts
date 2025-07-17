import { useState, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  loadingText: string;
  progress?: number;
}

export interface LoadingScreenHook {
  loadingState: LoadingState;
  setLoadingState: (state: Partial<LoadingState>) => void;
  showLoading: (text?: string) => void;
  hideLoading: () => void;
  updateProgress: (progress: number, text?: string) => void;
}

export function useLoadingScreen(initialText = "Loading..."): LoadingScreenHook {
  const [loadingState, setLoadingStateInternal] = useState<LoadingState>({
    isLoading: false,
    loadingText: initialText,
    progress: undefined,
  });

  const setLoadingState = (state: Partial<LoadingState>) => {
    setLoadingStateInternal(prev => ({ ...prev, ...state }));
  };

  const showLoading = (text?: string) => {
    setLoadingState({
      isLoading: true,
      loadingText: text || initialText,
      progress: undefined,
    });
  };

  const hideLoading = () => {
    setLoadingState({
      isLoading: false,
      progress: undefined,
    });
  };

  const updateProgress = (progress: number, text?: string) => {
    setLoadingState({
      isLoading: true,
      progress: Math.max(0, Math.min(100, progress)),
      loadingText: text || loadingState.loadingText,
    });
  };

  return {
    loadingState,
    setLoadingState,
    showLoading,
    hideLoading,
    updateProgress,
  };
}

// Common loading sequences
export const LOADING_SEQUENCES = {
  APP_STARTUP: [
    { text: "Starting Manuel...", duration: 1000 },
    { text: "Loading configuration...", duration: 800 },
    { text: "Checking authentication...", duration: 600 },
    { text: "Almost ready...", duration: 500 },
  ],
  
  AUTHENTICATION: [
    { text: "Authenticating...", duration: 1000 },
    { text: "Verifying credentials...", duration: 800 },
    { text: "Loading user data...", duration: 600 },
  ],
  
  DATA_LOADING: [
    { text: "Loading your data...", duration: 800 },
    { text: "Syncing manuals...", duration: 700 },
    { text: "Preparing interface...", duration: 500 },
  ],
};

// Hook for sequential loading with predefined sequences
export function useSequentialLoading() {
  const { loadingState, setLoadingState, hideLoading } = useLoadingScreen();
  const [currentStep, setCurrentStep] = useState(0);

  const startSequence = async (sequence: typeof LOADING_SEQUENCES.APP_STARTUP) => {
    setLoadingState({ isLoading: true });
    
    for (let i = 0; i < sequence.length; i++) {
      const step = sequence[i];
      setCurrentStep(i);
      setLoadingState({ 
        loadingText: step.text,
        progress: ((i + 1) / sequence.length) * 100,
      });
      
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
    
    hideLoading();
    setCurrentStep(0);
  };

  return {
    loadingState,
    currentStep,
    startSequence,
    hideLoading,
  };
}