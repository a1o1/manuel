import { Command } from 'commander';
export declare class ConfigCommand {
    private storageService;
    static register(program: Command): void;
    show(options?: any): Promise<void>;
    set(key: string, value: string): Promise<void>;
    get(key: string): Promise<void>;
    reset(options?: any): Promise<void>;
    interactive(): Promise<void>;
    private getConfig;
    private saveConfig;
    private getDefaultConfig;
    private parseConfigValue;
}
//# sourceMappingURL=config.d.ts.map