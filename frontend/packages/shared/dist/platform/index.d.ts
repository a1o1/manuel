export * from './storage';
export * from './audio';
export * from './file';
export declare const Platform: {
    isReactNative: boolean;
    isNode: string | false;
    isIOS: boolean;
    isAndroid: boolean;
    isMacOS: boolean;
    isWindows: boolean;
    isLinux: boolean;
};
export { createStorageService, getStorageService, createStorageAdapter } from './storage';
export { createAudioService, getAudioService, createAudioAdapter } from './audio';
export { createFileService, getFileService, createFileAdapter } from './file';
//# sourceMappingURL=index.d.ts.map