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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeStorageAdapter = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Node.js storage adapter using filesystem
class NodeStorageAdapter {
    constructor(appName = 'manuel') {
        // Store in user's home directory under a hidden folder
        this.storageDir = path.join(os.homedir(), `.${appName}`);
        this.ensureStorageDir();
    }
    async ensureStorageDir() {
        try {
            await fs.access(this.storageDir);
        }
        catch {
            await fs.mkdir(this.storageDir, { recursive: true });
        }
    }
    getFilePath(key) {
        // Sanitize key for filesystem use
        const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.storageDir, `${safeKey}.json`);
    }
    async setItem(key, value) {
        try {
            await this.ensureStorageDir();
            const filePath = this.getFilePath(key);
            // Encrypt sensitive data (basic obfuscation for local storage)
            const encrypted = Buffer.from(value).toString('base64');
            await fs.writeFile(filePath, encrypted, 'utf8');
        }
        catch (error) {
            console.error('Error storing item:', error);
            throw error;
        }
    }
    async getItem(key) {
        try {
            const filePath = this.getFilePath(key);
            const encrypted = await fs.readFile(filePath, 'utf8');
            // Decrypt data
            const decrypted = Buffer.from(encrypted, 'base64').toString('utf8');
            return decrypted;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist
            }
            console.error('Error retrieving item:', error);
            return null;
        }
    }
    async removeItem(key) {
        try {
            const filePath = this.getFilePath(key);
            await fs.unlink(filePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error removing item:', error);
                throw error;
            }
        }
    }
    async clear() {
        try {
            const files = await fs.readdir(this.storageDir);
            await Promise.all(files
                .filter(file => file.endsWith('.json'))
                .map(file => fs.unlink(path.join(this.storageDir, file))));
        }
        catch (error) {
            console.error('Error clearing storage:', error);
            throw error;
        }
    }
    // CLI-specific methods
    async getStorageDir() {
        return this.storageDir;
    }
    async listKeys() {
        try {
            const files = await fs.readdir(this.storageDir);
            return files
                .filter(file => file.endsWith('.json'))
                .map(file => file.replace('.json', '').replace(/_/g, ':'));
        }
        catch {
            return [];
        }
    }
}
exports.NodeStorageAdapter = NodeStorageAdapter;
//# sourceMappingURL=node.js.map