import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { authService } from '@manuel/shared';
import { getStorageService } from '@manuel/shared';
import { CLIError, handleError } from '../utils/error';
import { validateEmail, validatePassword } from '../utils/validation';

export class AuthCommand {
  private storageService = getStorageService();

  static register(program: Command) {
    const auth = new AuthCommand();

    program
      .command('login')
      .description('Login to your Manuel account')
      .option('-e, --email <email>', 'Email address')
      .option('-p, --password <password>', 'Password (not recommended for security)')
      .action(async (options) => {
        await handleError(() => auth.login(options));
      });

    program
      .command('logout')
      .description('Logout from your account')
      .action(async () => {
        await handleError(() => auth.logout());
      });

    program
      .command('signup')
      .description('Create a new Manuel account')
      .option('-e, --email <email>', 'Email address')
      .action(async (options) => {
        await handleError(() => auth.signup(options));
      });

    program
      .command('status')
      .description('Check authentication status')
      .action(async () => {
        await handleError(() => auth.status());
      });

    program
      .command('forgot-password')
      .description('Reset your password')
      .option('-e, --email <email>', 'Email address')
      .action(async (options) => {
        await handleError(() => auth.forgotPassword(options));
      });

    program
      .command('confirm')
      .description('Confirm account signup or password reset')
      .option('-e, --email <email>', 'Email address')
      .option('-c, --code <code>', 'Confirmation code')
      .option('-t, --type <type>', 'Confirmation type (signup|password-reset)')
      .action(async (options) => {
        await handleError(() => auth.confirm(options));
      });
  }

  async login(options: any = {}) {
    console.log(chalk.blue('🔐 Manuel Login\n'));

    let email = options.email;
    let password = options.password;

    // Prompt for missing credentials
    if (!email || !password) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          when: !email,
          validate: validateEmail,
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

    const spinner = ora('Signing in...').start();

    try {
      const { tokens, user } = await authService.signIn({ email, password });

      // Store tokens and user data
      await this.storageService.storeAuthTokens({
        accessToken: tokens.AccessToken,
        refreshToken: tokens.RefreshToken,
        idToken: tokens.IdToken,
      });
      await this.storageService.storeUser(user);

      spinner.succeed(chalk.green('Successfully logged in!'));
      console.log(chalk.gray(`Welcome back, ${user.email}`));

    } catch (error) {
      spinner.fail('Login failed');
      throw new CLIError(`Authentication failed: ${error}`);
    }
  }

  async logout() {
    const spinner = ora('Signing out...').start();

    try {
      // Check if user is logged in
      const tokens = await this.storageService.getAuthTokens();
      if (!tokens) {
        spinner.info('You are not logged in');
        return;
      }

      // Sign out from Cognito
      await authService.signOut();

      // Clear local storage
      await this.storageService.removeAuthTokens();
      await this.storageService.removeUser();

      spinner.succeed(chalk.green('Successfully logged out!'));

    } catch (error) {
      spinner.fail('Logout failed');
      console.warn(chalk.yellow('Local session cleared anyway'));
      // Clear local storage even if remote logout fails
      await this.storageService.removeAuthTokens();
      await this.storageService.removeUser();
    }
  }

  async signup(options: any = {}) {
    console.log(chalk.blue('📝 Create Manuel Account\n'));

    let email = options.email;

    if (!email) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: validateEmail,
        },
      ]);
      email = answers.email;
    }

    // Get user's name
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Full name:',
        default: email.split('@')[0],
        validate: (input: string) => {
          if (input.trim().length < 2) {
            return 'Name must be at least 2 characters';
          }
          return true;
        },
      },
    ]);

    // Password prompts
    const { password, confirmPassword } = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
        validate: validatePassword,
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

    const spinner = ora('Creating account...').start();

    try {
      const result = await authService.signUp({
        email,
        password,
        confirmPassword,
        name,
      });

      spinner.succeed(chalk.green('Account created successfully!'));

      if (result.needsConfirmation) {
        console.log(chalk.yellow('\n📧 Please check your email for a confirmation code.'));
        console.log(chalk.gray('Use "manuel auth confirm" to verify your account.'));
      } else {
        console.log(chalk.green('\n✅ Your account is ready! You can now log in.'));
      }

    } catch (error) {
      spinner.fail('Account creation failed');
      throw new CLIError(`Signup failed: ${error}`);
    }
  }

  async status() {
    const spinner = ora('Checking authentication status...').start();

    try {
      const tokens = await this.storageService.getAuthTokens();

      if (!tokens) {
        spinner.info(chalk.yellow('Not logged in'));
        console.log(chalk.gray('Use "manuel auth login" to sign in.'));
        return;
      }

      const user = await this.storageService.getUser();
      const isAuthenticated = await authService.isAuthenticated();

      if (isAuthenticated && user) {
        spinner.succeed(chalk.green('Logged in'));
        console.log(chalk.gray(`Email: ${user.email}`));
        console.log(chalk.gray(`Verified: ${user.email_verified ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`Member since: ${new Date(user.created_at).toLocaleDateString()}`));
      } else {
        spinner.warn(chalk.yellow('Session expired'));
        console.log(chalk.gray('Please log in again.'));

        // Clear expired session
        await this.storageService.removeAuthTokens();
        await this.storageService.removeUser();
      }

    } catch (error) {
      spinner.fail('Status check failed');
      console.error(chalk.red(`Error: ${error}`));
    }
  }

  async forgotPassword(options: any = {}) {
    console.log(chalk.blue('🔑 Reset Password\n'));

    let email = options.email;

    if (!email) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: 'Email:',
          validate: validateEmail,
        },
      ]);
      email = answers.email;
    }

    const spinner = ora('Sending reset code...').start();

    try {
      await authService.forgotPassword(email);

      spinner.succeed(chalk.green('Reset code sent!'));
      console.log(chalk.yellow('\n📧 Please check your email for a reset code.'));
      console.log(chalk.gray('Use "manuel auth confirm --type password-reset" to reset your password.'));

    } catch (error) {
      spinner.fail('Failed to send reset code');
      throw new CLIError(`Password reset failed: ${error}`);
    }
  }

  async confirm(options: any = {}) {
    let { email, code, type } = options;

    // Determine confirmation type
    if (!type) {
      const { confirmationType } = await inquirer.prompt([
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
        validate: validateEmail,
      });
    }

    if (!code) {
      prompts.push({
        type: 'input',
        name: 'code',
        message: 'Confirmation code:',
        validate: (input: string) => {
          if (input.length !== 6) {
            return 'Confirmation code must be 6 digits';
          }
          return true;
        },
      });
    }

    if (prompts.length > 0) {
      const answers = await inquirer.prompt(prompts);
      email = email || answers.email;
      code = code || answers.code;
    }

    const spinner = ora('Confirming...').start();

    try {
      if (type === 'signup') {
        await authService.confirmSignUp(email, code);
        spinner.succeed(chalk.green('Account confirmed successfully!'));
        console.log(chalk.gray('You can now log in with your credentials.'));
      } else if (type === 'password-reset') {
        // Get new password
        const { newPassword, confirmPassword } = await inquirer.prompt([
          {
            type: 'password',
            name: 'newPassword',
            message: 'New password:',
            mask: '*',
            validate: validatePassword,
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

        await authService.confirmForgotPassword(email, code, newPassword);
        spinner.succeed(chalk.green('Password reset successfully!'));
        console.log(chalk.gray('You can now log in with your new password.'));
      }

    } catch (error) {
      spinner.fail('Confirmation failed');
      throw new CLIError(`Confirmation failed: ${error}`);
    }
  }
}
