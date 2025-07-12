"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_THEME = exports.DARK_THEME = exports.LIGHT_THEME = void 0;
exports.LIGHT_THEME = {
    colors: {
        primary: '#007AFF',
        secondary: '#5AC8FA',
        background: '#FFFFFF',
        surface: '#F2F2F7',
        text: '#000000',
        textSecondary: '#8E8E93',
        border: '#E5E5EA',
        error: '#FF3B30',
        success: '#34C759',
        warning: '#FF9500',
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
    },
    borderRadius: {
        sm: 4,
        md: 8,
        lg: 12,
    },
    typography: {
        h1: {
            fontSize: 32,
            fontWeight: 'bold',
        },
        h2: {
            fontSize: 24,
            fontWeight: 'bold',
        },
        h3: {
            fontSize: 20,
            fontWeight: '600',
        },
        body: {
            fontSize: 16,
            fontWeight: 'normal',
        },
        caption: {
            fontSize: 12,
            fontWeight: 'normal',
        },
    },
};
exports.DARK_THEME = {
    ...exports.LIGHT_THEME,
    colors: {
        primary: '#0A84FF',
        secondary: '#64D2FF',
        background: '#000000',
        surface: '#1C1C1E',
        text: '#FFFFFF',
        textSecondary: '#8E8E93',
        border: '#38383A',
        error: '#FF453A',
        success: '#30D158',
        warning: '#FF9F0A',
    },
};
// Default theme
exports.DEFAULT_THEME = exports.LIGHT_THEME;
//# sourceMappingURL=theme.js.map