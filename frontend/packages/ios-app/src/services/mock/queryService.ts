import { QueryService } from '../index';
import { mockUserContext } from './userContext';

interface UserQueryData {
  manuals: string[];
  answers: string[];
  sources: Array<{
    manual_name: string;
    page_number: number;
    chunk_text: string;
  }>;
}

export class MockQueryService implements QueryService {
  private userQueryData = new Map<string, UserQueryData>();

  constructor() {
    // Initialize user-specific query data based on their manuals
    this.userQueryData.set('user1', {
      manuals: ['WiFi Router Setup Guide', 'Smart TV User Manual'],
      answers: [
        "To reset your WiFi password, access your router's admin panel at 192.168.1.1, navigate to Wireless Settings, and look for the 'Change Password' or 'Passphrase' option.",
        "For the Smart TV, go to Settings > Network > WiFi Setup and select your network from the available list.",
        "According to your router manual, the default username is 'admin' and the password is printed on the device label.",
        "To connect your Smart TV to WiFi, use the remote to navigate to Network Settings in the TV's menu system.",
      ],
      sources: [
        {
          manual_name: "WiFi Router Setup Guide",
          page_number: 15,
          chunk_text: "WiFi configuration can be accessed through the web interface at 192.168.1.1..."
        },
        {
          manual_name: "Smart TV User Manual",
          page_number: 23,
          chunk_text: "Network connectivity options include WiFi, Ethernet, and wireless display..."
        }
      ]
    });

    this.userQueryData.set('user2', {
      manuals: ['Coffee Machine Guide'],
      answers: [
        "To brew coffee, fill the water reservoir, add ground coffee to the filter, and press the brew button.",
        "For cleaning, run a vinegar solution through the machine monthly, followed by two cycles of clean water.",
        "The grind setting should be medium for optimal extraction. Adjust based on taste preference.",
        "Regular descaling is recommended every 3 months or after 300 brew cycles, whichever comes first.",
      ],
      sources: [
        {
          manual_name: "Coffee Machine Guide",
          page_number: 12,
          chunk_text: "Daily brewing instructions: Fill reservoir with cold, filtered water..."
        },
        {
          manual_name: "Coffee Machine Guide",
          page_number: 28,
          chunk_text: "Maintenance schedule includes weekly cleaning and monthly descaling..."
        }
      ]
    });

    this.userQueryData.set('user3', {
      manuals: [],
      answers: [
        "I don't have any manuals uploaded yet. Please upload a manual first to get specific answers.",
      ],
      sources: []
    });
  }

  private getCurrentUserId(): string {
    return mockUserContext.getCurrentUserId();
  }

  private getUserQueryData(userId: string): UserQueryData {
    return this.userQueryData.get(userId) || {
      manuals: [],
      answers: ["I don't have any manuals uploaded yet. Please upload a manual first to get specific answers."],
      sources: []
    };
  }

  async textQuery(query: string, options?: any) {
    await this.delay(2000 + Math.random() * 1000);

    const currentUserId = this.getCurrentUserId();
    const queryData = this.getUserQueryData(currentUserId);

    if (queryData.manuals.length === 0) {
      return {
        answer: "I don't have any manuals uploaded yet. Please upload a manual first to get specific answers about your products.",
        sources: undefined,
        cost: 0.001,
        responseTime: Math.floor(Math.random() * 500 + 200),
      };
    }

    return {
      answer: queryData.answers[Math.floor(Math.random() * queryData.answers.length)],
      sources: options?.includeSources ? queryData.sources.slice(0, 2) : undefined,
      cost: Math.random() * 0.05 + 0.01,
      responseTime: Math.floor(Math.random() * 1000 + 500),
    };
  }

  async voiceQuery(audioBlob: Blob, options?: any) {
    await this.delay(3000 + Math.random() * 2000);

    const currentUserId = this.getCurrentUserId();
    const queryData = this.getUserQueryData(currentUserId);

    if (queryData.manuals.length === 0) {
      return {
        transcription: "How do I use this device?",
        answer: "I don't have any manuals uploaded yet. Please upload a manual first to get specific answers about your products.",
        sources: undefined,
        cost: 0.002,
        responseTime: Math.floor(Math.random() * 1000 + 500),
      };
    }

    // Mock transcription based on user's manual type
    const transcriptions = queryData.manuals.includes('Coffee Machine Guide') 
      ? ["How do I brew coffee?", "How often should I clean the machine?"]
      : ["How do I connect to WiFi?", "How do I reset the device?"];

    return {
      transcription: transcriptions[Math.floor(Math.random() * transcriptions.length)],
      answer: queryData.answers[Math.floor(Math.random() * queryData.answers.length)],
      sources: options?.includeSources ? queryData.sources.slice(0, 1) : undefined,
      cost: Math.random() * 0.08 + 0.02,
      responseTime: Math.floor(Math.random() * 2000 + 1000),
    };
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
