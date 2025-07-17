export interface ApiResponse<T = any> {
    statusCode: number;
    data?: T;
    error?: string;
    details?: string;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface SignupRequest {
    email: string;
    password: string;
    confirmPassword: string;
    name?: string;
}
export interface AuthTokens {
    AccessToken: string;
    IdToken: string;
    RefreshToken: string;
    ExpiresIn: number;
}
export interface Manual {
    id: string;
    name: string;
    size: number;
    upload_date: string;
}
export interface ManualUploadRequest {
    file_name: string;
    file_data: string;
    content_type: string;
}
export interface ManualDownloadRequest {
    url: string;
    filename?: string;
}
export interface ManualUploadResponse {
    message: string;
    key: string;
    file_name: string;
    status: string;
    size_bytes?: number;
    content_type?: string;
    download_time_ms?: number;
    security_warnings?: string[];
}
export interface QueryRequest {
    query: string;
    file_data?: string;
    content_type?: string;
    include_sources?: boolean;
}
export interface QueryResponse {
    response: string;
    sources?: QuerySource[];
    usage?: UsageInfo;
    costs?: CostInfo;
    processing_time_ms?: number;
}
export interface QuerySource {
    content: string;
    metadata: {
        source: string;
        score: number;
    };
}
export interface UsageInfo {
    daily_queries: number;
    monthly_queries: number;
    daily_limit: number;
    monthly_limit: number;
    daily_remaining: number;
    monthly_remaining: number;
}
export interface CostInfo {
    total_cost: number;
    transcribe_cost: number;
    bedrock_cost: number;
    currency: string;
}
export interface UsageStats {
    current_usage: UsageInfo;
    daily_costs: CostInfo;
    recent_queries: RecentQuery[];
}
export interface RecentQuery {
    timestamp: string;
    query: string;
    response_time_ms: number;
    cost: number;
}
export interface ApiError {
    error: string;
    details?: string;
    code?: string;
}
export interface UploadFile {
    uri: string;
    name: string;
    type: string;
    size?: number;
}
//# sourceMappingURL=api.d.ts.map