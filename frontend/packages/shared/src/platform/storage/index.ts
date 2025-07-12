export * from './base';

import { StorageService, StorageAdapter } from './base';

// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Factory function to create appropriate storage adapter
export function createStorageAdapter(): StorageAdapter {
  if (isReactNative) {
    const { ReactNativeStorageAdapter } = require('./react-native');
    return new ReactNativeStorageAdapter();
  } else if (isNode) {
    const { NodeStorageAdapter } = require('./node');
    return new NodeStorageAdapter();
  } else {
    throw new Error('Unsupported platform for storage adapter');
  }
}

// Create storage service instance
export function createStorageService(): StorageService {
  const adapter = createStorageAdapter();
  return new StorageService(adapter);
}

// Default storage service (singleton)
let defaultStorageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!defaultStorageService) {
    defaultStorageService = createStorageService();
  }
  return defaultStorageService;
}
