import { ManualsService } from '../index';
import { mockUserContext } from './userContext';

interface UserManual {
  id: string;
  name: string;
  uploadDate: string;
  pages: number;
  size: string;
  status: 'processing' | 'processed' | 'failed';
  userId: string;
}

export class MockManualsService implements ManualsService {
  private userManuals = new Map<string, UserManual[]>();

  constructor() {
    // Initialize with sample data for different users
    this.userManuals.set('user1', [
      {
        id: '1',
        name: 'WiFi Router Setup Guide',
        uploadDate: '2024-01-15',
        pages: 24,
        size: '2.1 MB',
        status: 'processed',
        userId: 'user1',
      },
      {
        id: '2',
        name: 'Smart TV User Manual',
        uploadDate: '2024-01-10',
        pages: 45,
        size: '5.8 MB',
        status: 'processed',
        userId: 'user1',
      },
    ]);

    this.userManuals.set('user2', [
      {
        id: '3',
        name: 'Coffee Machine Guide',
        uploadDate: '2024-01-12',
        pages: 18,
        size: '1.5 MB',
        status: 'processed',
        userId: 'user2',
      },
    ]);
  }

  private getCurrentUserId(): string {
    return mockUserContext.getCurrentUserId();
  }

  private getUserManuals(userId: string): UserManual[] {
    return this.userManuals.get(userId) || [];
  }

  async getManuals() {
    await this.delay(800);
    const currentUserId = this.getCurrentUserId();
    const userManuals = this.getUserManuals(currentUserId);
    return userManuals.map(({ userId, ...manual }) => manual);
  }

  async uploadManual(file: File) {
    await this.delay(3000);
    const currentUserId = this.getCurrentUserId();

    const newManual: UserManual = {
      id: Date.now().toString(),
      name: file.name,
      uploadDate: new Date().toISOString().split('T')[0],
      pages: Math.floor(Math.random() * 50 + 10),
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      status: 'processing',
      userId: currentUserId,
    };

    // Add to user's manuals
    const userManuals = this.getUserManuals(currentUserId);
    userManuals.push(newManual);
    this.userManuals.set(currentUserId, userManuals);

    // Simulate processing completion after 5 seconds
    setTimeout(() => {
      newManual.status = 'processed';
    }, 5000);

    const { userId, ...returnManual } = newManual;
    return returnManual;
  }

  async deleteManual(id: string) {
    await this.delay(500);
    const currentUserId = this.getCurrentUserId();
    const userManuals = this.getUserManuals(currentUserId);
    
    const index = userManuals.findIndex(m => m.id === id);
    if (index > -1) {
      userManuals.splice(index, 1);
      this.userManuals.set(currentUserId, userManuals);
    }
  }

  async getManualDetail(id: string) {
    await this.delay(600);
    const currentUserId = this.getCurrentUserId();
    const userManuals = this.getUserManuals(currentUserId);
    const manual = userManuals.find(m => m.id === id);
    
    if (!manual) throw new Error('Manual not found');

    const { userId, ...manualData } = manual;
    return {
      ...manualData,
      chunks: Math.floor(Math.random() * 200 + 50),
      lastQueried: '2024-01-20',
      queryCount: Math.floor(Math.random() * 25 + 5),
    };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
