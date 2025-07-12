import { AxiosRequestConfig } from 'axios';
declare class ApiService {
    private client;
    constructor();
    private setupInterceptors;
    private refreshTokens;
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
    uploadFile<T = any>(url: string, data: FormData, onProgress?: (progress: number) => void): Promise<T>;
    setAuthToken(token: string): void;
    removeAuthToken(): void;
}
export declare const apiService: ApiService;
export {};
//# sourceMappingURL=api.d.ts.map