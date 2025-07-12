import { Command } from 'commander';
export declare class ManualsCommand {
    private fileService;
    static register(program: Command): void;
    list(options?: any): Promise<void>;
    upload(filePath: string, options?: any): Promise<void>;
    download(url: string, options?: any): Promise<void>;
    delete(key: string, options?: any): Promise<void>;
    info(key: string): Promise<void>;
    search(term: string): Promise<void>;
    interactive(): Promise<void>;
}
//# sourceMappingURL=manuals.d.ts.map