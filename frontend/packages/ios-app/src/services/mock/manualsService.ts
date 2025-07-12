import { ManualsService } from '../index';

export class MockManualsService implements ManualsService {
  private mockManuals = [
    {
      id: '1',
      name: 'WiFi Router Setup Guide',
      uploadDate: '2024-01-15',
      pages: 24,
      size: '2.1 MB',
      status: 'processed',
    },
    {
      id: '2',
      name: 'Smart TV User Manual',
      uploadDate: '2024-01-10',
      pages: 45,
      size: '5.8 MB',
      status: 'processed',
    },
  ];

  async getManuals() {
    await this.delay(800);
    return [...this.mockManuals];
  }

  async uploadManual(file: File) {
    await this.delay(3000);

    const newManual = {
      id: Date.now().toString(),
      name: file.name,
      uploadDate: new Date().toISOString().split('T')[0],
      pages: Math.floor(Math.random() * 50 + 10),
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      status: 'processing',
    };

    this.mockManuals.push(newManual);

    // Simulate processing completion after 5 seconds
    setTimeout(() => {
      newManual.status = 'processed';
    }, 5000);

    return newManual;
  }

  async deleteManual(id: string) {
    await this.delay(500);
    const index = this.mockManuals.findIndex(m => m.id === id);
    if (index > -1) {
      this.mockManuals.splice(index, 1);
    }
  }

  async getManualDetail(id: string) {
    await this.delay(600);
    const manual = this.mockManuals.find(m => m.id === id);
    if (!manual) throw new Error('Manual not found');

    return {
      ...manual,
      chunks: Math.floor(Math.random() * 200 + 50),
      lastQueried: '2024-01-20',
      queryCount: Math.floor(Math.random() * 25 + 5),
    };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
