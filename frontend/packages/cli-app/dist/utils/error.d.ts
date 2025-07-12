export declare class CLIError extends Error {
    constructor(message: string);
}
export declare function handleError<T>(fn: () => Promise<T>): Promise<T | void>;
//# sourceMappingURL=error.d.ts.map