"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeAudioAdapter = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const child_process_1 = require("child_process");
const base_1 = require("./base");
class NodeAudioAdapter extends base_1.AudioAdapter {
    constructor() {
        super();
        this.recordingProcess = null;
        this.playbackProcess = null;
        this.isRecordingActive = false;
        this.recordingStartTime = 0;
        this.recordingPath = '';
        this.tempDir = path.join(os.tmpdir(), 'manuel-audio');
        this.ensureTempDir();
    }
    async ensureTempDir() {
        try {
            await fs.access(this.tempDir);
        }
        catch {
            await fs.mkdir(this.tempDir, { recursive: true });
        }
    }
    async requestPermissions() {
        // On macOS/Linux, check if we can access audio recording
        return await this.checkPermissions();
    }
    async checkPermissions() {
        try {
            // Check if sox is available (common audio utility)
            const { spawn } = require('child_process');
            return new Promise((resolve) => {
                const process = spawn('which', ['sox'], { stdio: 'ignore' });
                process.on('close', (code) => {
                    resolve(code === 0);
                });
                process.on('error', () => {
                    resolve(false);
                });
            });
        }
        catch {
            return false;
        }
    }
    async startRecording(options = {}) {
        if (this.isRecordingActive) {
            throw new Error('Recording already in progress');
        }
        try {
            await this.ensureTempDir();
            // Generate unique filename
            const timestamp = Date.now();
            this.recordingPath = path.join(this.tempDir, `recording_${timestamp}.wav`);
            // Use sox for cross-platform audio recording
            const soxArgs = [
                '-d', // Default audio device
                '-r', (options.sampleRate || 44100).toString(), // Sample rate
                '-c', (options.channels || 1).toString(), // Channels
                '-b', '16', // Bit depth
                this.recordingPath,
            ];
            // Add duration limit if specified
            if (options.maxDuration) {
                soxArgs.push('trim', '0', options.maxDuration.toString());
            }
            this.recordingProcess = (0, child_process_1.spawn)('sox', soxArgs, { stdio: 'pipe' });
            this.recordingProcess.on('error', (error) => {
                this.isRecordingActive = false;
                throw new Error(`Recording failed: ${error.message}`);
            });
            this.isRecordingActive = true;
            this.recordingStartTime = Date.now();
        }
        catch (error) {
            this.isRecordingActive = false;
            throw new Error(`Failed to start recording: ${error}`);
        }
    }
    async stopRecording() {
        if (!this.isRecordingActive || !this.recordingProcess) {
            throw new Error('No active recording to stop');
        }
        try {
            // Stop the recording process
            this.recordingProcess.kill('SIGTERM');
            // Wait for process to finish
            await new Promise((resolve, reject) => {
                this.recordingProcess.on('close', resolve);
                this.recordingProcess.on('error', reject);
                setTimeout(() => reject(new Error('Recording stop timeout')), 5000);
            });
            const duration = (Date.now() - this.recordingStartTime) / 1000;
            // Get file stats
            const stats = await fs.stat(this.recordingPath);
            const audioRecording = {
                uri: this.recordingPath,
                duration,
                size: stats.size,
                format: 'wav',
            };
            this.isRecordingActive = false;
            this.recordingProcess = null;
            return audioRecording;
        }
        catch (error) {
            this.isRecordingActive = false;
            throw new Error(`Failed to stop recording: ${error}`);
        }
    }
    async pauseRecording() {
        if (!this.recordingProcess || !this.isRecordingActive) {
            throw new Error('No active recording to pause');
        }
        try {
            this.recordingProcess.kill('SIGSTOP');
        }
        catch (error) {
            throw new Error(`Failed to pause recording: ${error}`);
        }
    }
    async resumeRecording() {
        if (!this.recordingProcess) {
            throw new Error('No recording to resume');
        }
        try {
            this.recordingProcess.kill('SIGCONT');
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
            // Stop any existing playback
            await this.stopPlayback();
            // Use platform-appropriate audio player
            let command;
            let args;
            if (process.platform === 'darwin') {
                // macOS - use afplay
                command = 'afplay';
                args = [uri];
            }
            else if (process.platform === 'linux') {
                // Linux - use aplay or sox
                command = 'aplay';
                args = [uri];
            }
            else {
                throw new Error('Audio playback not supported on this platform');
            }
            this.playbackProcess = (0, child_process_1.spawn)(command, args, { stdio: 'pipe' });
            this.playbackProcess.on('error', (error) => {
                throw new Error(`Playback failed: ${error.message}`);
            });
        }
        catch (error) {
            throw new Error(`Failed to play audio: ${error}`);
        }
    }
    async stopPlayback() {
        if (this.playbackProcess) {
            try {
                this.playbackProcess.kill('SIGTERM');
                this.playbackProcess = null;
            }
            catch (error) {
                console.error('Error stopping playback:', error);
            }
        }
    }
    async pausePlayback() {
        if (this.playbackProcess) {
            try {
                this.playbackProcess.kill('SIGSTOP');
            }
            catch (error) {
                throw new Error(`Failed to pause playback: ${error}`);
            }
        }
    }
    async resumePlayback() {
        if (this.playbackProcess) {
            try {
                this.playbackProcess.kill('SIGCONT');
            }
            catch (error) {
                throw new Error(`Failed to resume playback: ${error}`);
            }
        }
    }
    isPlaying() {
        return this.playbackProcess !== null && !this.playbackProcess.killed;
    }
    async convertToBase64(uri) {
        try {
            const buffer = await fs.readFile(uri);
            return buffer.toString('base64');
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
            if (this.recordingProcess && this.isRecordingActive) {
                this.recordingProcess.kill('SIGTERM');
            }
            if (this.playbackProcess) {
                this.playbackProcess.kill('SIGTERM');
            }
            // Clean up temporary files
            try {
                const files = await fs.readdir(this.tempDir);
                await Promise.all(files.map(file => fs.unlink(path.join(this.tempDir, file))));
            }
            catch (error) {
                console.error('Error cleaning up temp files:', error);
            }
            this.recordingProcess = null;
            this.playbackProcess = null;
            this.isRecordingActive = false;
        }
        catch (error) {
            console.error('Error during audio cleanup:', error);
        }
    }
}
exports.NodeAudioAdapter = NodeAudioAdapter;
//# sourceMappingURL=node.js.map