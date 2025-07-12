"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const chalk_1 = __importDefault(require("chalk"));
const shared_1 = require("@manuel/shared");
const error_1 = require("./error");
const storageService = (0, shared_1.getStorageService)();
async function requireAuth() {
    const tokens = await storageService.getAuthTokens();
    if (!tokens) {
        throw new error_1.CLIError(`Authentication required. Please run "${chalk_1.default.cyan('manuel auth login')}" first.`);
    }
    // TODO: Check if tokens are still valid
    // For now, we'll rely on the API to return 401 if tokens are expired
}
//# sourceMappingURL=auth.js.map