export * from './base';

import { FileService, FileAdapter } from './base';

// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Factory function to create appropriate file adapter
export function createFileAdapter(): FileAdapter {
  if (isReactNative) {
    const { ReactNativeFileAdapter } = require('./react-native');
    return new ReactNativeFileAdapter();
  } else if (isNode) {
    const { NodeFileAdapter } = require('./node');
    return new NodeFileAdapter();
  } else {
    throw new Error('Unsupported platform for file adapter');
  }
}

// Create file service instance
export function createFileService(): FileService {
  const adapter = createFileAdapter();
  return new FileService(adapter);
}

// Default file service (singleton)
let defaultFileService: FileService | null = null;

export function getFileService(): FileService {
  if (!defaultFileService) {
    defaultFileService = createFileService();
  }
  return defaultFileService;
}
