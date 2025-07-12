export * from './storage';
export * from './validation';
export * from './formatting';
export declare const handleApiError: (error: any) => string;
export declare const debounce: <T extends (...args: any[]) => any>(func: T, delay: number) => ((...args: Parameters<T>) => void);
export declare const throttle: <T extends (...args: any[]) => any>(func: T, delay: number) => ((...args: Parameters<T>) => void);
export declare const generateId: () => string;
export declare const isIOS: boolean;
export declare const isAndroid: boolean;
export declare const getStatusBarHeight: () => number;
export declare const hexToRgba: (hex: string, alpha: number) => string;
export declare const groupBy: <T, K extends keyof any>(array: T[], getKey: (item: T) => K) => Record<K, T[]>;
export declare const sleep: (ms: number) => Promise<void>;
//# sourceMappingURL=index.d.ts.map