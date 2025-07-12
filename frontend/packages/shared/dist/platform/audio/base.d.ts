export interface AudioRecording {
    uri: string;
    duration: number;
    size: number;
    format: string;
}
export interface AudioRecordingOptions {
    quality?: 'low' | 'medium' | 'high';
    maxDuration?: number;
    channels?: 1 | 2;
    sampleRate?: number;
    bitRate?: number;
}
export interface AudioPlaybackOptions {
    volume?: number;
    loop?: boolean;
}
export declare abstract class AudioAdapter {
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
    abstract requestPermissions(): Promise<boolean>;
    abstract checkPermissions(): Promise<boolean>;
}
export interface AudioEvents {
    onRecordingStart?: () => void;
    onRecordingStop?: (recording: AudioRecording) => void;
    onRecordingError?: (error: Error) => void;
    onPlaybackStart?: () => void;
    onPlaybackStop?: () => void;
    onPlaybackError?: (error: Error) => void;
}
export declare class AudioService {
    private adapter;
    private events;
    constructor(adapter: AudioAdapter);
    setEvents(events: AudioEvents): void;
    requestPermissions(): Promise<boolean>;
    startRecording(options?: AudioRecordingOptions): Promise<void>;
    stopRecording(): Promise<AudioRecording>;
    playAudio(uri: string, options?: AudioPlaybackOptions): Promise<void>;
    convertToBase64(uri: string): Promise<string>;
    isRecording(): boolean;
    getRecordingDuration(): number;
    getAudioFormat(): string;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=base.d.ts.map