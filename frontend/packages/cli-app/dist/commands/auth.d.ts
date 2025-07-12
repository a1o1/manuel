import { Command } from 'commander';
export declare class AuthCommand {
    private storageService;
    static register(program: Command): void;
    login(options?: any): Promise<void>;
    logout(): Promise<void>;
    signup(options?: any): Promise<void>;
    status(): Promise<void>;
    forgotPassword(options?: any): Promise<void>;
    confirm(options?: any): Promise<void>;
}
//# sourceMappingURL=auth.d.ts.map