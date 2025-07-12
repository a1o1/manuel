export declare const API_CONFIG: {
    BASE_URL: string;
    TIMEOUT: number;
    RETRY_ATTEMPTS: number;
    RETRY_DELAY: number;
};
export declare const COGNITO_CONFIG: {
    USER_POOL_ID: string;
    CLIENT_ID: string;
    REGION: string;
    IDENTITY_POOL_ID: string;
};
export declare const AUDIO_CONFIG: {
    SAMPLE_RATE: number;
    CHANNELS: number;
    BIT_DEPTH: number;
    MAX_DURATION: number;
    FORMAT: string;
    QUALITY: "high";
};
export declare const UPLOAD_CONFIG: {
    MAX_FILE_SIZE: number;
    ALLOWED_TYPES: string[];
    ALLOWED_EXTENSIONS: string[];
};
export declare const APP_CONFIG: {
    NAME: string;
    VERSION: string;
    BUILD_NUMBER: number;
    STORE_URL: {
        ios: string;
        android: string;
    };
    SUPPORT_EMAIL: string;
    PRIVACY_URL: string;
    TERMS_URL: string;
};
export declare const FEATURES: {
    VOICE_RECORDING: boolean;
    FILE_UPLOAD: boolean;
    URL_DOWNLOAD: boolean;
    USAGE_ANALYTICS: boolean;
    PUSH_NOTIFICATIONS: boolean;
    OFFLINE_MODE: boolean;
};
export declare const UI_CONSTANTS: {
    HEADER_HEIGHT: number;
    TAB_BAR_HEIGHT: number;
    ANIMATION_DURATION: number;
    DEBOUNCE_DELAY: number;
    TOAST_DURATION: number;
};
export declare const STORAGE_KEYS: {
    readonly AUTH_TOKENS: "@manuel:auth_tokens";
    readonly USER_DATA: "@manuel:user_data";
    readonly SETTINGS: "@manuel:settings";
    readonly QUERY_HISTORY: "@manuel:query_history";
    readonly LAST_SESSION: "@manuel:last_session";
};
//# sourceMappingURL=config.d.ts.map