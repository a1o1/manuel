import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import { AudioAdapter, AudioRecording, AudioRecordingOptions, AudioPlaybackOptions } from './base';

export class NodeAudioAdapter extends AudioAdapter {
  private recordingProcess: ChildProcess | null = null;
  private playbackProcess: ChildProcess | null = null;
  private isRecordingActive = false;
  private recordingStartTime = 0;
  private recordingPath = '';
  private tempDir: string;

  constructor() {
    super();
    this.tempDir = path.join(os.tmpdir(), 'manuel-audio');
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  async requestPermissions(): Promise<boolean> {
    // On macOS/Linux, check if we can access audio recording
    return await this.checkPermissions();
  }

  async checkPermissions(): Promise<boolean> {
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
    } catch {
      return false;
    }
  }

  async startRecording(options: AudioRecordingOptions = {}): Promise<void> {
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

      this.recordingProcess = spawn('sox', soxArgs, { stdio: 'pipe' });

      this.recordingProcess.on('error', (error) => {
        this.isRecordingActive = false;
        throw new Error(`Recording failed: ${error.message}`);
      });

      this.isRecordingActive = true;
      this.recordingStartTime = Date.now();

    } catch (error) {
      this.isRecordingActive = false;
      throw new Error(`Failed to start recording: ${error}`);
    }
  }

  async stopRecording(): Promise<AudioRecording> {
    if (!this.isRecordingActive || !this.recordingProcess) {
      throw new Error('No active recording to stop');
    }

    try {
      // Stop the recording process
      this.recordingProcess.kill('SIGTERM');

      // Wait for process to finish
      await new Promise((resolve, reject) => {
        this.recordingProcess!.on('close', resolve);
        this.recordingProcess!.on('error', reject);
        setTimeout(() => reject(new Error('Recording stop timeout')), 5000);
      });

      const duration = (Date.now() - this.recordingStartTime) / 1000;

      // Get file stats
      const stats = await fs.stat(this.recordingPath);

      const audioRecording: AudioRecording = {
        uri: this.recordingPath,
        duration,
        size: stats.size,
        format: 'wav',
      };

      this.isRecordingActive = false;
      this.recordingProcess = null;

      return audioRecording;
    } catch (error) {
      this.isRecordingActive = false;
      throw new Error(`Failed to stop recording: ${error}`);
    }
  }

  async pauseRecording(): Promise<void> {
    if (!this.recordingProcess || !this.isRecordingActive) {
      throw new Error('No active recording to pause');
    }

    try {
      this.recordingProcess.kill('SIGSTOP');
    } catch (error) {
      throw new Error(`Failed to pause recording: ${error}`);
    }
  }

  async resumeRecording(): Promise<void> {
    if (!this.recordingProcess) {
      throw new Error('No recording to resume');
    }

    try {
      this.recordingProcess.kill('SIGCONT');
    } catch (error) {
      throw new Error(`Failed to resume recording: ${error}`);
    }
  }

  isRecording(): boolean {
    return this.isRecordingActive;
  }

  getRecordingDuration(): number {
    if (!this.isRecordingActive) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  async playAudio(uri: string, options: AudioPlaybackOptions = {}): Promise<void> {
    try {
      // Stop any existing playback
      await this.stopPlayback();

      // Use platform-appropriate audio player
      let command: string;
      let args: string[];

      if (process.platform === 'darwin') {
        // macOS - use afplay
        command = 'afplay';
        args = [uri];
      } else if (process.platform === 'linux') {
        // Linux - use aplay or sox
        command = 'aplay';
        args = [uri];
      } else {
        throw new Error('Audio playback not supported on this platform');
      }

      this.playbackProcess = spawn(command, args, { stdio: 'pipe' });

      this.playbackProcess.on('error', (error) => {
        throw new Error(`Playback failed: ${error.message}`);
      });

    } catch (error) {
      throw new Error(`Failed to play audio: ${error}`);
    }
  }

  async stopPlayback(): Promise<void> {
    if (this.playbackProcess) {
      try {
        this.playbackProcess.kill('SIGTERM');
        this.playbackProcess = null;
      } catch (error) {
        console.error('Error stopping playback:', error);
      }
    }
  }

  async pausePlayback(): Promise<void> {
    if (this.playbackProcess) {
      try {
        this.playbackProcess.kill('SIGSTOP');
      } catch (error) {
        throw new Error(`Failed to pause playback: ${error}`);
      }
    }
  }

  async resumePlayback(): Promise<void> {
    if (this.playbackProcess) {
      try {
        this.playbackProcess.kill('SIGCONT');
      } catch (error) {
        throw new Error(`Failed to resume playback: ${error}`);
      }
    }
  }

  isPlaying(): boolean {
    return this.playbackProcess !== null && !this.playbackProcess.killed;
  }

  async convertToBase64(uri: string): Promise<string> {
    try {
      const buffer = await fs.readFile(uri);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to convert audio to base64: ${error}`);
    }
  }

  getAudioFormat(): string {
    return 'wav';
  }

  async cleanup(): Promise<void> {
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
        await Promise.all(
          files.map(file => fs.unlink(path.join(this.tempDir, file)))
        );
      } catch (error) {
        console.error('Error cleaning up temp files:', error);
      }

      this.recordingProcess = null;
      this.playbackProcess = null;
      this.isRecordingActive = false;
    } catch (error) {
      console.error('Error during audio cleanup:', error);
    }
  }
}
