"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const services_1 = require("../services");
const storage_1 = require("../utils/storage");
// Initial state
const initialState = {
    isAuthenticated: false,
    user: null,
    tokens: {
        accessToken: null,
        refreshToken: null,
        idToken: null,
    },
    isLoading: true,
    error: null,
};
// Reducer
function authReducer(state, action) {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        case 'SET_USER':
            return { ...state, user: action.payload };
        case 'SET_TOKENS':
            return {
                ...state,
                tokens: action.payload || { accessToken: null, refreshToken: null, idToken: null },
            };
        case 'SET_AUTHENTICATED':
            return { ...state, isAuthenticated: action.payload };
        case 'RESET_STATE':
            return { ...initialState, isLoading: false };
        default:
            return state;
    }
}
// Create context
const AuthContext = (0, react_1.createContext)(undefined);
function AuthProvider({ children }) {
    const [state, dispatch] = (0, react_1.useReducer)(authReducer, initialState);
    // Initialize auth state on app start
    (0, react_1.useEffect)(() => {
        initializeAuth();
    }, []);
    const initializeAuth = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            // Check for stored tokens
            const tokens = await storage_1.AuthStorage.getTokens();
            if (tokens) {
                dispatch({ type: 'SET_TOKENS', payload: tokens });
                // Check if user is still authenticated
                const isAuthenticated = await services_1.authService.isAuthenticated();
                if (isAuthenticated) {
                    const user = await services_1.authService.getCurrentUser();
                    if (user) {
                        dispatch({ type: 'SET_USER', payload: user });
                        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
                    }
                }
                else {
                    // Tokens are expired/invalid, clear them
                    await clearAuthData();
                }
            }
        }
        catch (error) {
            console.error('Auth initialization error:', error);
            await clearAuthData();
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const clearAuthData = async () => {
        await storage_1.AuthStorage.removeTokens();
        await storage_1.UserStorage.removeUser();
        dispatch({ type: 'RESET_STATE' });
    };
    const signIn = async (credentials) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            const { tokens, user } = await services_1.authService.signIn(credentials);
            // Store tokens securely
            await storage_1.AuthStorage.storeTokens({
                accessToken: tokens.AccessToken,
                refreshToken: tokens.RefreshToken,
                idToken: tokens.IdToken,
            });
            // Store user data
            await storage_1.UserStorage.storeUser(user);
            // Update state
            dispatch({ type: 'SET_TOKENS', payload: {
                    accessToken: tokens.AccessToken,
                    refreshToken: tokens.RefreshToken,
                    idToken: tokens.IdToken,
                } });
            dispatch({ type: 'SET_USER', payload: user });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const signUp = async (userData) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            const result = await services_1.authService.signUp(userData);
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const confirmSignUp = async (email, code) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            await services_1.authService.confirmSignUp(email, code);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Confirmation failed';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const resendConfirmationCode = async (email) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            await services_1.authService.resendConfirmationCode(email);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to resend code';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const signOut = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            await services_1.authService.signOut();
            await clearAuthData();
        }
        catch (error) {
            console.error('Sign out error:', error);
            // Even if sign out fails, clear local data
            await clearAuthData();
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const forgotPassword = async (email) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            await services_1.authService.forgotPassword(email);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send reset code';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const confirmForgotPassword = async (email, code, newPassword) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            await services_1.authService.confirmForgotPassword(email, code, newPassword);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const changePassword = async (oldPassword, newPassword) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            await services_1.authService.changePassword(oldPassword, newPassword);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Password change failed';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            throw error;
        }
        finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    };
    const refreshTokens = async () => {
        try {
            const newTokens = await services_1.authService.refreshTokens();
            await storage_1.AuthStorage.storeTokens({
                accessToken: newTokens.AccessToken,
                refreshToken: newTokens.RefreshToken,
                idToken: newTokens.IdToken,
            });
            dispatch({ type: 'SET_TOKENS', payload: {
                    accessToken: newTokens.AccessToken,
                    refreshToken: newTokens.RefreshToken,
                    idToken: newTokens.IdToken,
                } });
        }
        catch (error) {
            console.error('Token refresh failed:', error);
            await clearAuthData();
            throw error;
        }
    };
    const clearError = () => {
        dispatch({ type: 'SET_ERROR', payload: null });
    };
    const value = {
        state,
        signIn,
        signUp,
        confirmSignUp,
        resendConfirmationCode,
        signOut,
        forgotPassword,
        confirmForgotPassword,
        changePassword,
        refreshTokens,
        clearError,
    };
    return (0, jsx_runtime_1.jsx)(AuthContext.Provider, { value: value, children: children });
}
// Custom hook to use auth context
function useAuth() {
    const context = (0, react_1.useContext)(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
//# sourceMappingURL=AuthContext.js.map