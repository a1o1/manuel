import { QueryService } from '../index';

export class MockQueryService implements QueryService {
  async textQuery(query: string, options?: any) {
    await this.delay(2000 + Math.random() * 1000);

    const mockAnswers = [
      "To reset your WiFi password, access your router's admin panel at 192.168.1.1, navigate to Wireless Settings, and look for the 'Change Password' or 'Passphrase' option.",
      "According to the manual, you should first unplug the device for 30 seconds, then plug it back in while holding the reset button for 10 seconds.",
      "The troubleshooting section indicates this error occurs when the firmware is outdated. Please download the latest firmware from the manufacturer's website.",
      "Based on the installation guide, ensure all cables are properly connected and the power indicator shows a solid green light before proceeding.",
    ];

    return {
      answer: mockAnswers[Math.floor(Math.random() * mockAnswers.length)],
      sources: options?.includeSources ? [
        {
          manual_name: "Router Setup Guide v2.1",
          page_number: 15,
          chunk_text: "WiFi configuration can be accessed through the web interface..."
        },
        {
          manual_name: "Troubleshooting Manual",
          page_number: 8,
          chunk_text: "Common connectivity issues and their solutions..."
        }
      ] : undefined,
      cost: Math.random() * 0.05 + 0.01,
      responseTime: Math.floor(Math.random() * 1000 + 500),
    };
  }

  async voiceQuery(audioBlob: Blob, options?: any) {
    await this.delay(3000 + Math.random() * 2000);

    // Mock transcription + query
    return {
      transcription: "How do I connect to WiFi?",
      answer: "To connect to WiFi, go to Settings > WiFi, select your network, and enter the password found on your router's label.",
      sources: options?.includeSources ? [
        {
          manual_name: "Quick Start Guide",
          page_number: 3,
          chunk_text: "WiFi connection steps for first-time setup..."
        }
      ] : undefined,
      cost: Math.random() * 0.08 + 0.02,
      responseTime: Math.floor(Math.random() * 2000 + 1000),
    };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
