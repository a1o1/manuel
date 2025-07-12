"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeAudioAdapter = void 0;
const base_1 = require("./base");
class ReactNativeAudioAdapter extends base_1.AudioAdapter {
    constructor() {
        super();
        this.recording = null;
        this.sound = null;
        this.isRecordingActive = false;
        this.recordingStartTime = 0;
        try {
            this.Audio = require('expo-av').Audio;
            this.FileSystem = require('expo-file-system');
        }
        catch (error) {
            throw new Error('expo-av and expo-file-system are required for React Native audio');
        }
    }
    async requestPermissions() {
        try {
            const { status } = await this.Audio.requestPermissionsAsync();
            return status === 'granted';
        }
        catch (error) {
            console.error('Error requesting audio permissions:', error);
            return false;
        }
    }
    async checkPermissions() {
        try {
            const { status } = await this.Audio.getPermissionsAsync();
            return status === 'granted';
        }
        catch (error) {
            console.error('Error checking audio permissions:', error);
            return false;
        }
    }
    async startRecording(options = {}) {
        try {
            // Set audio mode for recording
            await this.Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });
            // Configure recording options
            const recordingOptions = {
                android: {
                    extension: '.wav',
                    outputFormat: this.Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_DEFAULT,
                    audioEncoder: this.Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_DEFAULT,
                    sampleRate: options.sampleRate || 44100,
                    numberOfChannels: options.channels || 1,
                    bitRate: options.bitRate || 128000,
                },
                ios: {
                    extension: '.wav',
                    outputFormat: this.Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_LINEARPCM,
                    audioQuality: this.mapQuality(options.quality || 'high'),
                    sampleRate: options.sampleRate || 44100,
                    numberOfChannels: options.channels || 1,
                    bitRate: options.bitRate || 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
            };
            // Create and start recording
            this.recording = new this.Audio.Recording();
            await this.recording.prepareToRecordAsync(recordingOptions);
            await this.recording.startAsync();
            this.isRecordingActive = true;
            this.recordingStartTime = Date.now();
            // Set maximum duration if specified
            if (options.maxDuration) {
                setTimeout(async () => {
                    if (this.isRecordingActive) {
                        await this.stopRecording();
                    }
                }, options.maxDuration * 1000);
            }
        }
        catch (error) {
            this.isRecordingActive = false;
            throw new Error(`Failed to start recording: ${error}`);
        }
    }
    async stopRecording() {
        if (!this.recording || !this.isRecordingActive) {
            throw new Error('No active recording to stop');
        }
        try {
            await this.recording.stopAndUnloadAsync();
            const uri = this.recording.getURI();
            const duration = (Date.now() - this.recordingStartTime) / 1000;
            // Get file info
            const fileInfo = await this.FileSystem.getInfoAsync(uri);
            const audioRecording = {
                uri,
                duration,
                size: fileInfo.size || 0,
                format: 'wav',
            };
            this.isRecordingActive = false;
            this.recording = null;
            return audioRecording;
        }
        catch (error) {
            this.isRecordingActive = false;
            throw new Error(`Failed to stop recording: ${error}`);
        }
    }
    async pauseRecording() {
        if (!this.recording || !this.isRecordingActive) {
            throw new Error('No active recording to pause');
        }
        try {
            await this.recording.pauseAsync();
        }
        catch (error) {
            throw new Error(`Failed to pause recording: ${error}`);
        }
    }
    async resumeRecording() {
        if (!this.recording) {
            throw new Error('No recording to resume');
        }
        try {
            await this.recording.startAsync();
        }
        catch (error) {
            throw new Error(`Failed to resume recording: ${error}`);
        }
    }
    isRecording() {
        return this.isRecordingActive;
    }
    getRecordingDuration() {
        if (!this.isRecordingActive)
            return 0;
        return (Date.now() - this.recordingStartTime) / 1000;
    }
    async playAudio(uri, options = {}) {
        try {
            // Unload previous sound
            if (this.sound) {
                await this.sound.unloadAsync();
            }
            // Create and load new sound
            const { sound } = await this.Audio.Sound.createAsync({ uri }, {
                shouldPlay: true,
                volume: options.volume || 1.0,
                isLooping: options.loop || false,
            });
            this.sound = sound;
            await this.sound.playAsync();
        }
        catch (error) {
            throw new Error(`Failed to play audio: ${error}`);
        }
    }
    async stopPlayback() {
        if (this.sound) {
            try {
                await this.sound.stopAsync();
            }
            catch (error) {
                console.error('Error stopping playback:', error);
            }
        }
    }
    async pausePlayback() {
        if (this.sound) {
            try {
                await this.sound.pauseAsync();
            }
            catch (error) {
                throw new Error(`Failed to pause playback: ${error}`);
            }
        }
    }
    async resumePlayback() {
        if (this.sound) {
            try {
                await this.sound.playAsync();
            }
            catch (error) {
                throw new Error(`Failed to resume playback: ${error}`);
            }
        }
    }
    isPlaying() {
        return this.sound ? this.sound.isLoaded() : false;
    }
    async convertToBase64(uri) {
        try {
            const base64 = await this.FileSystem.readAsStringAsync(uri, {
                encoding: this.FileSystem.EncodingType.Base64,
            });
            return base64;
        }
        catch (error) {
            throw new Error(`Failed to convert audio to base64: ${error}`);
        }
    }
    getAudioFormat() {
        return 'wav';
    }
    async cleanup() {
        try {
            if (this.recording && this.isRecordingActive) {
                await this.recording.stopAndUnloadAsync();
            }
            if (this.sound) {
                await this.sound.unloadAsync();
            }
            this.recording = null;
            this.sound = null;
            this.isRecordingActive = false;
        }
        catch (error) {
            console.error('Error during audio cleanup:', error);
        }
    }
    mapQuality(quality) {
        switch (quality) {
            case 'low':
                return this.Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MIN;
            case 'medium':
                return this.Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM;
            case 'high':
                return this.Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MAX;
            default:
                return this.Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH;
        }
    }
}
exports.ReactNativeAudioAdapter = ReactNativeAudioAdapter;
//# sourceMappingURL=react-native.js.map