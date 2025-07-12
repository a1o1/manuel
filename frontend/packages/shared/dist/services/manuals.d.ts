import { Manual, ManualUploadRequest, ManualDownloadRequest, ManualUploadResponse } from '../types';
declare class ManualService {
    getManuals(): Promise<{
        manuals: Manual[];
        count: number;
    }>;
    uploadManual(request: ManualUploadRequest): Promise<ManualUploadResponse>;
    downloadManual(request: ManualDownloadRequest): Promise<ManualUploadResponse>;
    uploadFromUrl(url: string, filename?: string): Promise<ManualUploadResponse>;
    deleteManual(key: string): Promise<void>;
    getManualMetadata(key: string): Promise<Manual>;
    getProcessingStatus(key: string): Promise<{
        status: string;
        job_id: string;
        created_at: string;
        updated_at: string;
    }>;
}
export declare const manualService: ManualService;
export {};
//# sourceMappingURL=manuals.d.ts.map