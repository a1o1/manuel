import { Command } from 'commander';
export declare class QueryCommand {
    private audioService;
    static register(program: Command): void;
    ask(question: string, options?: any): Promise<void>;
    voice(options?: any): Promise<void>;
    history(options?: any): Promise<void>;
    interactive(options?: any): Promise<void>;
    private waitForEnter;
}
//# sourceMappingURL=query.d.ts.map