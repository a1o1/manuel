export * from './base';

import { AudioService, AudioAdapter } from './base';

// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Factory function to create appropriate audio adapter
export function createAudioAdapter(): AudioAdapter {
  if (isReactNative) {
    const { ReactNativeAudioAdapter } = require('./react-native');
    return new ReactNativeAudioAdapter();
  } else if (isNode) {
    const { NodeAudioAdapter } = require('./node');
    return new NodeAudioAdapter();
  } else {
    throw new Error('Unsupported platform for audio adapter');
  }
}

// Create audio service instance
export function createAudioService(): AudioService {
  const adapter = createAudioAdapter();
  return new AudioService(adapter);
}

// Default audio service (singleton)
let defaultAudioService: AudioService | null = null;

export function getAudioService(): AudioService {
  if (!defaultAudioService) {
    defaultAudioService = createAudioService();
  }
  return defaultAudioService;
}
