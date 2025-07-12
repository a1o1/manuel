import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { StorageAdapter } from './base';

// Node.js storage adapter using filesystem
export class NodeStorageAdapter implements StorageAdapter {
  private storageDir: string;

  constructor(appName = 'manuel') {
    // Store in user's home directory under a hidden folder
    this.storageDir = path.join(os.homedir(), `.${appName}`);
    this.ensureStorageDir();
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem use
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storageDir, `${safeKey}.json`);
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await this.ensureStorageDir();
      const filePath = this.getFilePath(key);

      // Encrypt sensitive data (basic obfuscation for local storage)
      const encrypted = Buffer.from(value).toString('base64');
      await fs.writeFile(filePath, encrypted, 'utf8');
    } catch (error) {
      console.error('Error storing item:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(key);
      const encrypted = await fs.readFile(filePath, 'utf8');

      // Decrypt data
      const decrypted = Buffer.from(encrypted, 'base64').toString('utf8');
      return decrypted;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      console.error('Error retrieving item:', error);
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Error removing item:', error);
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.storageDir, file)))
      );
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // CLI-specific methods
  async getStorageDir(): Promise<string> {
    return this.storageDir;
  }

  async listKeys(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storageDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', '').replace(/_/g, ':'));
    } catch {
      return [];
    }
  }
}
