"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthCommand = void 0;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const shared_1 = require("@manuel/shared");
const shared_2 = require("@manuel/shared");
const error_1 = require("../utils/error");
const validation_1 = require("../utils/validation");
class AuthCommand {
    constructor() {
        this.storageService = (0, shared_2.getStorageService)();
    }
    static register(program) {
        const auth = new AuthCommand();
        program
            .command('login')
            .description('Login to your Manuel account')
            .option('-e, --email <email>', 'Email address')
            .option('-p, --password <password>', 'Password (not recommended for security)')
            .action(async (options) => {
            await (0, error_1.handleError)(() => auth.login(options));
        });
        program
            .command('logout')
            .description('Logout from your account')
            .action(async () => {
            await (0, error_1.handleError)(() => auth.logout());
        });
        program
            .command('signup')
            .description('Create a new Manuel account')
            .option('-e, --email <email>', 'Email address')
            .action(async (options) => {
            await (0, error_1.handleError)(() => auth.signup(options));
        });
        program
            .command('status')
            .description('Check authentication status')
            .action(async () => {
            await (0, error_1.handleError)(() => auth.status());
        });
        program
            .command('forgot-password')
            .description('Reset your password')
            .option('-e, --email <email>', 'Email address')
            .action(async (options) => {
            await (0, error_1.handleError)(() => auth.forgotPassword(options));
        });
        program
            .command('confirm')
            .description('Confirm account signup or password reset')
            .option('-e, --email <email>', 'Email address')
            .option('-c, --code <code>', 'Confirmation code')
            .option('-t, --type <type>', 'Confirmation type (signup|password-reset)')
            .action(async (options) => {
            await (0, error_1.handleError)(() => auth.confirm(options));
        });
    }
    async login(options = {}) {
        console.log(chalk_1.default.blue('🔐 Manuel Login\n'));
        let email = options.email;
        let password = options.password;
        // Prompt for missing credentials
        if (!email || !password) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: 'Email:',
                    when: !email,
                    validate: validation_1.validateEmail,
                },
                {
                    type: 'password',
                    name: 'password',
                    message: 'Password:',
                    when: !password,
                    mask: '*',
                },
            ]);
            email = email || answers.email;
            password = password || answers.password;
        }
        const spinner = (0, ora_1.default)('Signing in...').start();
        try {
            const { tokens, user } = await shared_1.authService.signIn({ email, password });
            // Store tokens and user data
            await this.storageService.storeAuthTokens({
                accessToken: tokens.AccessToken,
                refreshToken: tokens.RefreshToken,
                idToken: tokens.IdToken,
            });
            await this.storageService.storeUser(user);
            spinner.succeed(chalk_1.default.green('Successfully logged in!'));
            console.log(chalk_1.default.gray(`Welcome back, ${user.email}`));
        }
        catch (error) {
            spinner.fail('Login failed');
            throw new error_1.CLIError(`Authentication failed: ${error}`);
        }
    }
    async logout() {
        const spinner = (0, ora_1.default)('Signing out...').start();
        try {
            // Check if user is logged in
            const tokens = await this.storageService.getAuthTokens();
            if (!tokens) {
                spinner.info('You are not logged in');
                return;
            }
            // Sign out from Cognito
            await shared_1.authService.signOut();
            // Clear local storage
            await this.storageService.removeAuthTokens();
            await this.storageService.removeUser();
            spinner.succeed(chalk_1.default.green('Successfully logged out!'));
        }
        catch (error) {
            spinner.fail('Logout failed');
            console.warn(chalk_1.default.yellow('Local session cleared anyway'));
            // Clear local storage even if remote logout fails
            await this.storageService.removeAuthTokens();
            await this.storageService.removeUser();
        }
    }
    async signup(options = {}) {
        console.log(chalk_1.default.blue('📝 Create Manuel Account\n'));
        let email = options.email;
        if (!email) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: 'Email:',
                    validate: validation_1.validateEmail,
                },
            ]);
            email = answers.email;
        }
        // Get user's name
        const { name } = await inquirer_1.default.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Full name:',
                default: email.split('@')[0],
                validate: (input) => {
                    if (input.trim().length < 2) {
                        return 'Name must be at least 2 characters';
                    }
                    return true;
                },
            },
        ]);
        // Password prompts
        const { password, confirmPassword } = await inquirer_1.default.prompt([
            {
                type: 'password',
                name: 'password',
                message: 'Password:',
                mask: '*',
                validate: validation_1.validatePassword,
            },
            {
                type: 'password',
                name: 'confirmPassword',
                message: 'Confirm password:',
                mask: '*',
                validate: (input, answers) => {
                    if (input !== answers.password) {
                        return 'Passwords do not match';
                    }
                    return true;
                },
            },
        ]);
        const spinner = (0, ora_1.default)('Creating account...').start();
        try {
            const result = await shared_1.authService.signUp({
                email,
                password,
                confirmPassword,
                name,
            });
            spinner.succeed(chalk_1.default.green('Account created successfully!'));
            if (result.needsConfirmation) {
                console.log(chalk_1.default.yellow('\n📧 Please check your email for a confirmation code.'));
                console.log(chalk_1.default.gray('Use "manuel auth confirm" to verify your account.'));
            }
            else {
                console.log(chalk_1.default.green('\n✅ Your account is ready! You can now log in.'));
            }
        }
        catch (error) {
            spinner.fail('Account creation failed');
            throw new error_1.CLIError(`Signup failed: ${error}`);
        }
    }
    async status() {
        const spinner = (0, ora_1.default)('Checking authentication status...').start();
        try {
            const tokens = await this.storageService.getAuthTokens();
            if (!tokens) {
                spinner.info(chalk_1.default.yellow('Not logged in'));
                console.log(chalk_1.default.gray('Use "manuel auth login" to sign in.'));
                return;
            }
            const user = await this.storageService.getUser();
            const isAuthenticated = await shared_1.authService.isAuthenticated();
            if (isAuthenticated && user) {
                spinner.succeed(chalk_1.default.green('Logged in'));
                console.log(chalk_1.default.gray(`Email: ${user.email}`));
                console.log(chalk_1.default.gray(`Verified: ${user.email_verified ? 'Yes' : 'No'}`));
                console.log(chalk_1.default.gray(`Member since: ${new Date(user.created_at).toLocaleDateString()}`));
            }
            else {
                spinner.warn(chalk_1.default.yellow('Session expired'));
                console.log(chalk_1.default.gray('Please log in again.'));
                // Clear expired session
                await this.storageService.removeAuthTokens();
                await this.storageService.removeUser();
            }
        }
        catch (error) {
            spinner.fail('Status check failed');
            console.error(chalk_1.default.red(`Error: ${error}`));
        }
    }
    async forgotPassword(options = {}) {
        console.log(chalk_1.default.blue('🔑 Reset Password\n'));
        let email = options.email;
        if (!email) {
            const answers = await inquirer_1.default.prompt([
                {
                    type: 'input',
                    name: 'email',
                    message: 'Email:',
                    validate: validation_1.validateEmail,
                },
            ]);
            email = answers.email;
        }
        const spinner = (0, ora_1.default)('Sending reset code...').start();
        try {
            await shared_1.authService.forgotPassword(email);
            spinner.succeed(chalk_1.default.green('Reset code sent!'));
            console.log(chalk_1.default.yellow('\n📧 Please check your email for a reset code.'));
            console.log(chalk_1.default.gray('Use "manuel auth confirm --type password-reset" to reset your password.'));
        }
        catch (error) {
            spinner.fail('Failed to send reset code');
            throw new error_1.CLIError(`Password reset failed: ${error}`);
        }
    }
    async confirm(options = {}) {
        let { email, code, type } = options;
        // Determine confirmation type
        if (!type) {
            const { confirmationType } = await inquirer_1.default.prompt([
                {
                    type: 'list',
                    name: 'confirmationType',
                    message: 'What would you like to confirm?',
                    choices: [
                        { name: 'Account signup', value: 'signup' },
                        { name: 'Password reset', value: 'password-reset' },
                    ],
                },
            ]);
            type = confirmationType;
        }
        // Get missing information
        const prompts = [];
        if (!email) {
            prompts.push({
                type: 'input',
                name: 'email',
                message: 'Email:',
                validate: validation_1.validateEmail,
            });
        }
        if (!code) {
            prompts.push({
                type: 'input',
                name: 'code',
                message: 'Confirmation code:',
                validate: (input) => {
                    if (input.length !== 6) {
                        return 'Confirmation code must be 6 digits';
                    }
                    return true;
                },
            });
        }
        if (prompts.length > 0) {
            const answers = await inquirer_1.default.prompt(prompts);
            email = email || answers.email;
            code = code || answers.code;
        }
        const spinner = (0, ora_1.default)('Confirming...').start();
        try {
            if (type === 'signup') {
                await shared_1.authService.confirmSignUp(email, code);
                spinner.succeed(chalk_1.default.green('Account confirmed successfully!'));
                console.log(chalk_1.default.gray('You can now log in with your credentials.'));
            }
            else if (type === 'password-reset') {
                // Get new password
                const { newPassword, confirmPassword } = await inquirer_1.default.prompt([
                    {
                        type: 'password',
                        name: 'newPassword',
                        message: 'New password:',
                        mask: '*',
                        validate: validation_1.validatePassword,
                    },
                    {
                        type: 'password',
                        name: 'confirmPassword',
                        message: 'Confirm new password:',
                        mask: '*',
                        validate: (input, answers) => {
                            if (input !== answers.newPassword) {
                                return 'Passwords do not match';
                            }
                            return true;
                        },
                    },
                ]);
                await shared_1.authService.confirmForgotPassword(email, code, newPassword);
                spinner.succeed(chalk_1.default.green('Password reset successfully!'));
                console.log(chalk_1.default.gray('You can now log in with your new password.'));
            }
        }
        catch (error) {
            spinner.fail('Confirmation failed');
            throw new error_1.CLIError(`Confirmation failed: ${error}`);
        }
    }
}
exports.AuthCommand = AuthCommand;
//# sourceMappingURL=auth.js.map