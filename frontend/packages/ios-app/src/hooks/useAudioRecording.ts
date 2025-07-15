import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { logger } from '../utils/logger';
// Ensure crypto polyfills are available
import '../utils/crypto-polyfill';

export interface AudioRecordingResult {
  audioBlob: Blob | null;
  audioUri: string | null;
  duration: number;
  size: number;
}

export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

interface UseAudioRecordingReturn {
  state: RecordingState;
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<AudioRecordingResult | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  cancelRecording: () => void;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    // Set audio mode for recording
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      const granted = permission.status === 'granted';
      setHasPermission(granted);

      if (!granted) {
        logger.error('Audio recording permission denied');
      }

      return granted;
    } catch (error) {
      logger.error('Failed to request audio permission:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    timerRef.current = setInterval(() => {
      setDuration(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          throw new Error('Microphone permission required');
        }
      }

      // Create new recording instance
      const recording = new Audio.Recording();
      recordingRef.current = recording;

      // Configure recording options
      // Use a specific recording format that AWS Transcribe supports
      const recordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      // Prepare the recording
      await recording.prepareToRecordAsync(recordingOptions);

      // Start recording
      await recording.startAsync();

      setState('recording');
      pausedTimeRef.current = 0;
      startTimer();

      logger.log('Audio recording started');

    } catch (error) {
      logger.error('Failed to start recording:', error);
      setState('idle');
      recordingRef.current = null;
      throw error;
    }
  }, [hasPermission, requestPermission, startTimer]);

  const stopRecording = useCallback(async (): Promise<AudioRecordingResult | null> => {
    try {
      if (!recordingRef.current || state === 'idle') {
        return null;
      }

      // Stop the recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      const fileSize = fileInfo.exists ? fileInfo.size || 0 : 0;

      logger.log('Recording URI:', uri);
      logger.log('File exists:', fileInfo.exists);
      logger.log('File size:', fileSize);

      // Convert file to blob for API compatibility
      let audioBlob: Blob | null = null;

      try {
        // Read file as base64, then convert to blob
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Convert base64 to blob
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Use mp4 content type as expected by backend for m4a files
        audioBlob = new Blob([bytes], { type: 'audio/mp4' });
        logger.log('Audio file converted to blob, size:', audioBlob.size);
      } catch (blobError) {
        logger.error('Failed to convert audio to blob:', blobError);
      }

      const result: AudioRecordingResult = {
        audioBlob,
        audioUri: uri,
        duration,
        size: fileSize,
      };

      // Cleanup
      recordingRef.current = null;
      setState('stopped');
      stopTimer();

      logger.log('Audio recording stopped, duration:', duration, 'size:', fileSize);
      return result;

    } catch (error) {
      logger.error('Failed to stop recording:', error);
      setState('idle');
      recordingRef.current = null;
      stopTimer();
      throw error;
    }
  }, [state, duration, stopTimer]);

  const pauseRecording = useCallback(async () => {
    try {
      if (recordingRef.current && state === 'recording') {
        await recordingRef.current.pauseAsync();
        setState('paused');
        stopTimer();
        pausedTimeRef.current = duration;
        logger.log('Audio recording paused');
      }
    } catch (error) {
      logger.error('Failed to pause recording:', error);
    }
  }, [state, duration, stopTimer]);

  const resumeRecording = useCallback(async () => {
    try {
      if (recordingRef.current && state === 'paused') {
        await recordingRef.current.startAsync();
        setState('recording');
        startTimer();
        logger.log('Audio recording resumed');
      }
    } catch (error) {
      logger.error('Failed to resume recording:', error);
    }
  }, [state, startTimer]);

  const cancelRecording = useCallback(async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();

        // Try to delete the file
        const uri = recordingRef.current.getURI();
        if (uri) {
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      }
    } catch (error) {
      logger.error('Failed to cancel recording:', error);
    } finally {
      recordingRef.current = null;
      setState('idle');
      setDuration(0);
      pausedTimeRef.current = 0;
      stopTimer();
      logger.log('Audio recording cancelled');
    }
  }, [stopTimer]);

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';

  return {
    state,
    isRecording,
    isPaused,
    duration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    hasPermission,
    requestPermission,
  };
}
