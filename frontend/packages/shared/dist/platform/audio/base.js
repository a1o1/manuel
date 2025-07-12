"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = exports.AudioAdapter = void 0;
// Abstract audio interface
class AudioAdapter {
}
exports.AudioAdapter = AudioAdapter;
// Audio service wrapper
class AudioService {
    constructor(adapter) {
        this.events = {};
        this.adapter = adapter;
    }
    setEvents(events) {
        this.events = events;
    }
    async requestPermissions() {
        try {
            return await this.adapter.requestPermissions();
        }
        catch (error) {
            this.events.onRecordingError?.(error);
            return false;
        }
    }
    async startRecording(options) {
        try {
            const hasPermission = await this.adapter.checkPermissions();
            if (!hasPermission) {
                throw new Error('Audio recording permission required');
            }
            await this.adapter.startRecording(options);
            this.events.onRecordingStart?.();
        }
        catch (error) {
            this.events.onRecordingError?.(error);
            throw error;
        }
    }
    async stopRecording() {
        try {
            const recording = await this.adapter.stopRecording();
            this.events.onRecordingStop?.(recording);
            return recording;
        }
        catch (error) {
            this.events.onRecordingError?.(error);
            throw error;
        }
    }
    async playAudio(uri, options) {
        try {
            await this.adapter.playAudio(uri, options);
            this.events.onPlaybackStart?.();
        }
        catch (error) {
            this.events.onPlaybackError?.(error);
            throw error;
        }
    }
    async convertToBase64(uri) {
        return await this.adapter.convertToBase64(uri);
    }
    isRecording() {
        return this.adapter.isRecording();
    }
    getRecordingDuration() {
        return this.adapter.getRecordingDuration();
    }
    getAudioFormat() {
        return this.adapter.getAudioFormat();
    }
    async cleanup() {
        await this.adapter.cleanup();
    }
}
exports.AudioService = AudioService;
//# sourceMappingURL=base.js.map