import { AudioAdapter, AudioRecording, AudioRecordingOptions, AudioPlaybackOptions } from './base';
export declare class NodeAudioAdapter extends AudioAdapter {
    private recordingProcess;
    private playbackProcess;
    private isRecordingActive;
    private recordingStartTime;
    private recordingPath;
    private tempDir;
    constructor();
    private ensureTempDir;
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
}
//# sourceMappingURL=node.d.ts.map