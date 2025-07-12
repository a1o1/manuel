import { Command } from 'commander';
export declare class UsageCommand {
    static register(program: Command): void;
    overview(options?: any): Promise<void>;
    today(): Promise<void>;
    quotas(): Promise<void>;
    costs(options?: any): Promise<void>;
    history(options?: any): Promise<void>;
    export(options?: any): Promise<void>;
}
//# sourceMappingURL=usage.d.ts.map