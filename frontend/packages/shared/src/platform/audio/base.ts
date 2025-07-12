// Audio recording result
export interface AudioRecording {
  uri: string;
  duration: number;
  size: number;
  format: string;
}

// Audio recording options
export interface AudioRecordingOptions {
  quality?: 'low' | 'medium' | 'high';
  maxDuration?: number; // in seconds
  channels?: 1 | 2;
  sampleRate?: number;
  bitRate?: number;
}

// Audio playback options
export interface AudioPlaybackOptions {
  volume?: number; // 0.0 to 1.0
  loop?: boolean;
}

// Abstract audio interface
export abstract class AudioAdapter {
  abstract startRecording(options?: AudioRecordingOptions): Promise<void>;
  abstract stopRecording(): Promise<AudioRecording>;
  abstract pauseRecording(): Promise<void>;
  abstract resumeRecording(): Promise<void>;
  abstract isRecording(): boolean;
  abstract getRecordingDuration(): number;

  abstract playAudio(uri: string, options?: AudioPlaybackOptions): Promise<void>;
  abstract stopPlayback(): Promise<void>;
  abstract pausePlayback(): Promise<void>;
  abstract resumePlayback(): Promise<void>;
  abstract isPlaying(): boolean;

  abstract convertToBase64(uri: string): Promise<string>;
  abstract getAudioFormat(): string;
  abstract cleanup(): Promise<void>;

  // Platform-specific permission handling
  abstract requestPermissions(): Promise<boolean>;
  abstract checkPermissions(): Promise<boolean>;
}

// Audio events
export interface AudioEvents {
  onRecordingStart?: () => void;
  onRecordingStop?: (recording: AudioRecording) => void;
  onRecordingError?: (error: Error) => void;
  onPlaybackStart?: () => void;
  onPlaybackStop?: () => void;
  onPlaybackError?: (error: Error) => void;
}

// Audio service wrapper
export class AudioService {
  private adapter: AudioAdapter;
  private events: AudioEvents = {};

  constructor(adapter: AudioAdapter) {
    this.adapter = adapter;
  }

  setEvents(events: AudioEvents): void {
    this.events = events;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      return await this.adapter.requestPermissions();
    } catch (error) {
      this.events.onRecordingError?.(error as Error);
      return false;
    }
  }

  async startRecording(options?: AudioRecordingOptions): Promise<void> {
    try {
      const hasPermission = await this.adapter.checkPermissions();
      if (!hasPermission) {
        throw new Error('Audio recording permission required');
      }

      await this.adapter.startRecording(options);
      this.events.onRecordingStart?.();
    } catch (error) {
      this.events.onRecordingError?.(error as Error);
      throw error;
    }
  }

  async stopRecording(): Promise<AudioRecording> {
    try {
      const recording = await this.adapter.stopRecording();
      this.events.onRecordingStop?.(recording);
      return recording;
    } catch (error) {
      this.events.onRecordingError?.(error as Error);
      throw error;
    }
  }

  async playAudio(uri: string, options?: AudioPlaybackOptions): Promise<void> {
    try {
      await this.adapter.playAudio(uri, options);
      this.events.onPlaybackStart?.();
    } catch (error) {
      this.events.onPlaybackError?.(error as Error);
      throw error;
    }
  }

  async convertToBase64(uri: string): Promise<string> {
    return await this.adapter.convertToBase64(uri);
  }

  isRecording(): boolean {
    return this.adapter.isRecording();
  }

  getRecordingDuration(): number {
    return this.adapter.getRecordingDuration();
  }

  getAudioFormat(): string {
    return this.adapter.getAudioFormat();
  }

  async cleanup(): Promise<void> {
    await this.adapter.cleanup();
  }
}
