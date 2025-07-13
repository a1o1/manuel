"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIError = void 0;
exports.handleError = handleError;
const chalk_1 = __importDefault(require("chalk"));
class CLIError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CLIError';
    }
}
exports.CLIError = CLIError;
async function handleError(fn) {
    try {
        return await fn();
    }
    catch (error) {
        if (error instanceof CLIError) {
            console.error(chalk_1.default.red(`Error: ${error.message}`));
        }
        else if (error instanceof Error) {
            // Enhanced error handling for security and rate limiting
            const message = error.message;
            if (message.includes('Rate limit exceeded')) {
                console.error(chalk_1.default.yellow(`⏱️  ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Try spacing out your requests or check if you have multiple CLI instances running.'));
                console.log(chalk_1.default.gray('   Rate limit: 50 requests per 15-minute window'));
            }
            else if (message.includes('Access denied') || message.includes('IP not allowed')) {
                console.error(chalk_1.default.red(`🚫 ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: This may be due to network restrictions. Contact your administrator if needed.'));
            }
            else if (message.includes('Invalid input detected')) {
                console.error(chalk_1.default.red(`⚠️  ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Check for special characters, file format, or content that might trigger validation.'));
            }
            else if (message.includes('Request size exceeds')) {
                console.error(chalk_1.default.red(`📦 ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Try reducing file size or splitting large requests into smaller chunks.'));
            }
            else if (message.includes('Authentication failed')) {
                console.error(chalk_1.default.red(`🔐 ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Run "manuel login" to authenticate again.'));
            }
            else if (message.includes('Request timed out')) {
                console.error(chalk_1.default.yellow(`⏰ ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Check your internet connection or try again later.'));
            }
            else if (message.includes('Network error')) {
                console.error(chalk_1.default.red(`🌐 ${message}`));
                console.log(chalk_1.default.gray('💡 Tip: Verify your internet connection and try again.'));
            }
            else {
                // Default error handling
                console.error(chalk_1.default.red(`Error: ${message}`));
            }
            if (process.env.VERBOSE === 'true') {
                console.error(chalk_1.default.gray(error.stack));
            }
        }
        else {
            console.error(chalk_1.default.red(`Unknown error: ${error}`));
        }
        process.exit(1);
    }
}
//# sourceMappingURL=error.js.map
