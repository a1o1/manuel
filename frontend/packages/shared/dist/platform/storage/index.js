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
exports.createStorageAdapter = createStorageAdapter;
exports.createStorageService = createStorageService;
exports.getStorageService = getStorageService;
__exportStar(require("./base"), exports);
const base_1 = require("./base");
// Platform detection
const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
// Factory function to create appropriate storage adapter
function createStorageAdapter() {
    if (isReactNative) {
        const { ReactNativeStorageAdapter } = require('./react-native');
        return new ReactNativeStorageAdapter();
    }
    else if (isNode) {
        const { NodeStorageAdapter } = require('./node');
        return new NodeStorageAdapter();
    }
    else {
        throw new Error('Unsupported platform for storage adapter');
    }
}
// Create storage service instance
function createStorageService() {
    const adapter = createStorageAdapter();
    return new base_1.StorageService(adapter);
}
// Default storage service (singleton)
let defaultStorageService = null;
function getStorageService() {
    if (!defaultStorageService) {
        defaultStorageService = createStorageService();
    }
    return defaultStorageService;
}
//# sourceMappingURL=index.js.map