"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const amazon_cognito_identity_js_1 = require("amazon-cognito-identity-js");
const constants_1 = require("../constants");
const storage_1 = require("../utils/storage");
class AuthService {
    constructor() {
        this.userPool = new amazon_cognito_identity_js_1.CognitoUserPool({
            UserPoolId: constants_1.COGNITO_CONFIG.USER_POOL_ID,
            ClientId: constants_1.COGNITO_CONFIG.CLIENT_ID,
        });
    }
    // Sign up new user
    async signUp(request) {
        return new Promise((resolve, reject) => {
            const userName = request.name || request.email.split('@')[0];
            const attributeList = [
                new amazon_cognito_identity_js_1.CognitoUserAttribute({
                    Name: 'email',
                    Value: request.email,
                }),
                new amazon_cognito_identity_js_1.CognitoUserAttribute({
                    Name: 'name',
                    Value: userName,
                }),
            ];
            this.userPool.signUp(request.email, request.password, attributeList, [], (err, result) => {
                if (err) {
                    reject(new Error(err.message || 'Sign up failed'));
                    return;
                }
                if (!result) {
                    reject(new Error('Sign up failed'));
                    return;
                }
                resolve({
                    userSub: result.userSub,
                    needsConfirmation: !result.user,
                });
            });
        });
    }
    // Confirm sign up with verification code
    async confirmSignUp(email, code) {
        return new Promise((resolve, reject) => {
            const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                Username: email,
                Pool: this.userPool,
            });
            cognitoUser.confirmRegistration(code, true, (err) => {
                if (err) {
                    reject(new Error(err.message || 'Confirmation failed'));
                    return;
                }
                resolve();
            });
        });
    }
    // Resend confirmation code
    async resendConfirmationCode(email) {
        return new Promise((resolve, reject) => {
            const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                Username: email,
                Pool: this.userPool,
            });
            cognitoUser.resendConfirmationCode((err) => {
                if (err) {
                    reject(new Error(err.message || 'Failed to resend code'));
                    return;
                }
                resolve();
            });
        });
    }
    // Sign in user
    async signIn(request) {
        return new Promise((resolve, reject) => {
            const authenticationDetails = new amazon_cognito_identity_js_1.AuthenticationDetails({
                Username: request.email,
                Password: request.password,
            });
            const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                Username: request.email,
                Pool: this.userPool,
            });
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (session) => {
                    const tokens = {
                        AccessToken: session.getAccessToken().getJwtToken(),
                        IdToken: session.getIdToken().getJwtToken(),
                        RefreshToken: session.getRefreshToken().getToken(),
                        ExpiresIn: session.getAccessToken().getExpiration(),
                    };
                    const payload = session.getIdToken().payload;
                    const user = {
                        id: payload.sub,
                        email: payload.email,
                        email_verified: payload.email_verified || false,
                        created_at: new Date(payload.iat * 1000).toISOString(),
                    };
                    resolve({ tokens, user });
                },
                onFailure: (err) => {
                    reject(new Error(err.message || 'Sign in failed'));
                },
                newPasswordRequired: () => {
                    reject(new Error('New password required'));
                },
                mfaRequired: () => {
                    reject(new Error('MFA required (not implemented)'));
                },
                totpRequired: () => {
                    reject(new Error('TOTP required (not implemented)'));
                },
            });
        });
    }
    // Sign out user
    async signOut() {
        return new Promise((resolve) => {
            const cognitoUser = this.userPool.getCurrentUser();
            if (cognitoUser) {
                cognitoUser.signOut(() => {
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    // Get current authenticated user
    async getCurrentUser() {
        return new Promise((resolve) => {
            const cognitoUser = this.userPool.getCurrentUser();
            if (!cognitoUser) {
                resolve(null);
                return;
            }
            cognitoUser.getSession((err, session) => {
                if (err || !session || !session.isValid()) {
                    resolve(null);
                    return;
                }
                const payload = session.getIdToken().payload;
                const user = {
                    id: payload.sub,
                    email: payload.email,
                    email_verified: payload.email_verified || false,
                    created_at: new Date(payload.iat * 1000).toISOString(),
                };
                resolve(user);
            });
        });
    }
    // Get current session (with token restoration for CLI)
    async getCurrentSession() {
        return new Promise(async (resolve) => {
            let cognitoUser = this.userPool.getCurrentUser();
            // If no current user, try to restore from stored tokens
            if (!cognitoUser) {
                const tokens = await storage_1.AuthStorage.getTokens();
                const user = await storage_1.UserStorage.getUser();
                if (tokens && user) {
                    cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                        Username: user.email,
                        Pool: this.userPool,
                    });
                    // Set the session from stored tokens
                    const session = new amazon_cognito_identity_js_1.CognitoUserSession({
                        IdToken: new amazon_cognito_identity_js_1.CognitoIdToken({ IdToken: tokens.idToken }),
                        AccessToken: new amazon_cognito_identity_js_1.CognitoAccessToken({ AccessToken: tokens.accessToken }),
                        RefreshToken: new amazon_cognito_identity_js_1.CognitoRefreshToken({ RefreshToken: tokens.refreshToken }),
                    });
                    cognitoUser.setSignInUserSession(session);
                }
            }
            if (!cognitoUser) {
                resolve(null);
                return;
            }
            cognitoUser.getSession((err, session) => {
                if (err || !session || !session.isValid()) {
                    resolve(null);
                    return;
                }
                resolve(session);
            });
        });
    }
    // Refresh tokens (with user restoration for CLI)
    async refreshTokens() {
        return new Promise(async (resolve, reject) => {
            let cognitoUser = this.userPool.getCurrentUser();
            // If no current user, try to restore from stored tokens
            if (!cognitoUser) {
                const tokens = await storage_1.AuthStorage.getTokens();
                const user = await storage_1.UserStorage.getUser();
                if (tokens && user) {
                    cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                        Username: user.email,
                        Pool: this.userPool,
                    });
                    // Set the session from stored tokens
                    const session = new amazon_cognito_identity_js_1.CognitoUserSession({
                        IdToken: new amazon_cognito_identity_js_1.CognitoIdToken({ IdToken: tokens.idToken }),
                        AccessToken: new amazon_cognito_identity_js_1.CognitoAccessToken({ AccessToken: tokens.accessToken }),
                        RefreshToken: new amazon_cognito_identity_js_1.CognitoRefreshToken({ RefreshToken: tokens.refreshToken }),
                    });
                    cognitoUser.setSignInUserSession(session);
                }
            }
            if (!cognitoUser) {
                reject(new Error('No current user'));
                return;
            }
            cognitoUser.getSession((err, session) => {
                if (err || !session) {
                    reject(new Error('Failed to get session'));
                    return;
                }
                const refreshToken = session.getRefreshToken();
                cognitoUser.refreshSession(refreshToken, (refreshErr, refreshedSession) => {
                    if (refreshErr) {
                        reject(new Error(refreshErr.message || 'Token refresh failed'));
                        return;
                    }
                    const tokens = {
                        AccessToken: refreshedSession.getAccessToken().getJwtToken(),
                        IdToken: refreshedSession.getIdToken().getJwtToken(),
                        RefreshToken: refreshedSession.getRefreshToken().getToken(),
                        ExpiresIn: refreshedSession.getAccessToken().getExpiration(),
                    };
                    resolve(tokens);
                });
            });
        });
    }
    // Forgot password
    async forgotPassword(email) {
        return new Promise((resolve, reject) => {
            const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                Username: email,
                Pool: this.userPool,
            });
            cognitoUser.forgotPassword({
                onSuccess: () => {
                    resolve();
                },
                onFailure: (err) => {
                    reject(new Error(err.message || 'Failed to send reset code'));
                },
            });
        });
    }
    // Confirm forgot password
    async confirmForgotPassword(email, code, newPassword) {
        return new Promise((resolve, reject) => {
            const cognitoUser = new amazon_cognito_identity_js_1.CognitoUser({
                Username: email,
                Pool: this.userPool,
            });
            cognitoUser.confirmPassword(code, newPassword, {
                onSuccess: () => {
                    resolve();
                },
                onFailure: (err) => {
                    reject(new Error(err.message || 'Failed to reset password'));
                },
            });
        });
    }
    // Change password
    async changePassword(oldPassword, newPassword) {
        return new Promise((resolve, reject) => {
            const cognitoUser = this.userPool.getCurrentUser();
            if (!cognitoUser) {
                reject(new Error('No current user'));
                return;
            }
            cognitoUser.getSession((err, session) => {
                if (err || !session || !session.isValid()) {
                    reject(new Error('Invalid session'));
                    return;
                }
                cognitoUser.changePassword(oldPassword, newPassword, (changeErr) => {
                    if (changeErr) {
                        reject(new Error(changeErr.message || 'Failed to change password'));
                        return;
                    }
                    resolve();
                });
            });
        });
    }
    // Check if user is authenticated
    async isAuthenticated() {
        try {
            const session = await this.getCurrentSession();
            return session !== null && session.isValid();
        }
        catch {
            return false;
        }
    }
}
// Export singleton instance
exports.authService = new AuthService();
//# sourceMappingURL=auth.js.map
