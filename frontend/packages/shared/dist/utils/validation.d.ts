export declare const isValidEmail: (email: string) => boolean;
export declare const isValidPassword: (password: string) => boolean;
export declare const isValidFileType: (fileName: string, allowedExtensions: string[]) => boolean;
export declare const isValidFileSize: (size: number, maxSize: number) => boolean;
export declare const isValidUrl: (url: string) => boolean;
export declare const isValidQuery: (query: string) => boolean;
export declare const isValidPhoneNumber: (phone: string) => boolean;
export declare const VALIDATION_MESSAGES: {
    readonly EMAIL_INVALID: "Please enter a valid email address";
    readonly PASSWORD_WEAK: "Password must be at least 8 characters with uppercase, lowercase, and number";
    readonly PASSWORD_MISMATCH: "Passwords do not match";
    readonly REQUIRED_FIELD: "This field is required";
    readonly FILE_TYPE_INVALID: "File type not supported";
    readonly FILE_SIZE_INVALID: "File size exceeds maximum limit";
    readonly URL_INVALID: "Please enter a valid HTTPS URL";
    readonly QUERY_TOO_SHORT: "Query must be at least 3 characters";
    readonly QUERY_TOO_LONG: "Query must be less than 1000 characters";
    readonly PHONE_INVALID: "Please enter a valid phone number";
};
//# sourceMappingURL=validation.d.ts.map