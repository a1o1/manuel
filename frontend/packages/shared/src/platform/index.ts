export * from './storage';
export * from './audio';
export * from './file';

// Platform detection utilities
export const Platform = {
  isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative',
  isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
  isIOS: (() => {
    try {
      return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
             typeof require !== 'undefined' && require('react-native').Platform.OS === 'ios';
    } catch {
      return false;
    }
  })(),
  isAndroid: (() => {
    try {
      return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
             typeof require !== 'undefined' && require('react-native').Platform.OS === 'android';
    } catch {
      return false;
    }
  })(),
  isMacOS: typeof process !== 'undefined' && process.platform === 'darwin',
  isWindows: typeof process !== 'undefined' && process.platform === 'win32',
  isLinux: typeof process !== 'undefined' && process.platform === 'linux',
};

// Platform-specific service factories
export {
  createStorageService,
  getStorageService,
  createStorageAdapter
} from './storage';

export {
  createAudioService,
  getAudioService,
  createAudioAdapter
} from './audio';

export {
  createFileService,
  getFileService,
  createFileAdapter
} from './file';
