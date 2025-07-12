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
exports.createAudioAdapter = createAudioAdapter;
exports.createAudioService = createAudioService;
exports.getAudioService = getAudioService;
__exportStar(require("./base"), exports);
const base_1 = require("./base");
// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
// Factory function to create appropriate audio adapter
function createAudioAdapter() {
    if (isReactNative) {
        const { ReactNativeAudioAdapter } = require('./react-native');
        return new ReactNativeAudioAdapter();
    }
    else if (isNode) {
        const { NodeAudioAdapter } = require('./node');
        return new NodeAudioAdapter();
    }
    else {
        throw new Error('Unsupported platform for audio adapter');
    }
}
// Create audio service instance
function createAudioService() {
    const adapter = createAudioAdapter();
    return new base_1.AudioService(adapter);
}
// Default audio service (singleton)
let defaultAudioService = null;
function getAudioService() {
    if (!defaultAudioService) {
        defaultAudioService = createAudioService();
    }
    return defaultAudioService;
}
//# sourceMappingURL=index.js.map