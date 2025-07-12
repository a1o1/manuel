"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileAdapter = exports.getFileService = exports.createFileService = exports.createAudioAdapter = exports.getAudioService = exports.createAudioService = exports.createStorageAdapter = exports.getStorageService = exports.createStorageService = exports.Platform = void 0;
__exportStar(require("./storage"), exports);
__exportStar(require("./audio"), exports);
__exportStar(require("./file"), exports);
// Platform detection utilities
exports.Platform = {
    isReactNative: typeof navigator !== 'undefined' && navigator.product === 'ReactNative',
    isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
    isIOS: (() => {
        try {
            return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
                typeof require !== 'undefined' && require('react-native').Platform.OS === 'ios';
        }
        catch {
            return false;
        }
    })(),
    isAndroid: (() => {
        try {
            return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' &&
                typeof require !== 'undefined' && require('react-native').Platform.OS === 'android';
        }
        catch {
            return false;
        }
    })(),
    isMacOS: typeof process !== 'undefined' && process.platform === 'darwin',
    isWindows: typeof process !== 'undefined' && process.platform === 'win32',
    isLinux: typeof process !== 'undefined' && process.platform === 'linux',
};
// Platform-specific service factories
var storage_1 = require("./storage");
Object.defineProperty(exports, "createStorageService", { enumerable: true, get: function () { return storage_1.createStorageService; } });
Object.defineProperty(exports, "getStorageService", { enumerable: true, get: function () { return storage_1.getStorageService; } });
Object.defineProperty(exports, "createStorageAdapter", { enumerable: true, get: function () { return storage_1.createStorageAdapter; } });
var audio_1 = require("./audio");
Object.defineProperty(exports, "createAudioService", { enumerable: true, get: function () { return audio_1.createAudioService; } });
Object.defineProperty(exports, "getAudioService", { enumerable: true, get: function () { return audio_1.getAudioService; } });
Object.defineProperty(exports, "createAudioAdapter", { enumerable: true, get: function () { return audio_1.createAudioAdapter; } });
var file_1 = require("./file");
Object.defineProperty(exports, "createFileService", { enumerable: true, get: function () { return file_1.createFileService; } });
Object.defineProperty(exports, "getFileService", { enumerable: true, get: function () { return file_1.getFileService; } });
Object.defineProperty(exports, "createFileAdapter", { enumerable: true, get: function () { return file_1.createFileAdapter; } });
//# sourceMappingURL=index.js.map