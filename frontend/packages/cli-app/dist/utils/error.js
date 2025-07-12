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
            console.error(chalk_1.default.red(`Error: ${error.message}`));
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