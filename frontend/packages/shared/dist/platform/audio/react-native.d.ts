import { AudioAdapter, AudioRecording, AudioRecordingOptions, AudioPlaybackOptions } from './base';
export declare class ReactNativeAudioAdapter extends AudioAdapter {
    private Audio;
    private FileSystem;
    private recording;
    private sound;
    private isRecordingActive;
    private recordingStartTime;
    constructor();
    requestPermissions(): Promise<boolean>;
    checkPermissions(): Promise<boolean>;
    startRecording(options?: AudioRecordingOptions): Promise<void>;
    stopRecording(): Promise<AudioRecording>;
    pauseRecording(): Promise<void>;
    resumeRecording(): Promise<void>;
    isRecording(): boolean;
    getRecordingDuration(): number;
    playAudio(uri: string, options?: AudioPlaybackOptions): Promise<void>;
    stopPlayback(): Promise<void>;
    pausePlayback(): Promise<void>;
    resumePlayback(): Promise<void>;
    isPlaying(): boolean;
    convertToBase64(uri: string): Promise<string>;
    getAudioFormat(): string;
    cleanup(): Promise<void>;
    private mapQuality;
}
//# sourceMappingURL=react-native.d.ts.map