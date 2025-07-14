/**
 * Cognito Error Handler
 * Provides user-friendly error messages for Cognito authentication errors
 * Based on lessons learned from CLI auth implementation
 */

export interface CognitoError {
  title: string;
  message: string;
  actionRequired?: 'confirm_signup' | 'resend_code' | 'retry' | 'contact_support';
}

export function handleCognitoError(error: any): CognitoError {
  // Debug logging to understand error structure (only in development)
  if (__DEV__) {
    console.log('🔍 Authentication Error Debug:', {
      fullError: error,
      code: error?.code,
      name: error?.name,
      message: error?.message,
      type: typeof error
    });
  }

  const errorCode = error?.code || error?.name || '';
  const errorMessage = error?.message || error?.toString() || 'Unknown error';

  // Check error codes first (more reliable than message strings)

  // User not confirmed - needs email verification
  if (errorCode === 'UserNotConfirmedException' ||
      errorMessage.includes('User is not confirmed') ||
      errorMessage.includes('UserNotConfirmedException')) {
    return {
      title: 'Account Not Verified',
      message: 'Please check your email and confirm your account before signing in.',
      actionRequired: 'confirm_signup'
    };
  }

  // Wrong username or password (MOST COMMON ERROR - check first)
  if (errorCode === 'NotAuthorizedException' ||
      errorMessage.includes('Incorrect username or password') ||
      errorMessage.includes('NotAuthorizedException')) {
    return {
      title: 'Sign In Failed',
      message: 'Incorrect email or password. Please check your credentials and try again.'
    };
  }

  // User not found
  if (errorCode === 'UserNotFoundException' ||
      errorMessage.includes('User does not exist') ||
      errorMessage.includes('UserNotFoundException')) {
    return {
      title: 'Account Not Found',
      message: 'No account found with this email address. Please check the email or create a new account.'
    };
  }

  // Too many attempts
  if (errorCode === 'TooManyRequestsException' ||
      errorMessage.includes('Too many failed attempts') ||
      errorMessage.includes('TooManyRequestsException')) {
    return {
      title: 'Too Many Attempts',
      message: 'Too many failed attempts. Please wait a few minutes before trying again.'
    };
  }

  // Weak password
  if (errorCode === 'InvalidPasswordException' ||
      errorMessage.includes('Password did not conform') ||
      errorMessage.includes('InvalidPasswordException')) {
    return {
      title: 'Password Too Weak',
      message: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols.'
    };
  }

  // User already exists
  if (errorCode === 'UsernameExistsException' ||
      errorMessage.includes('User already exists') ||
      errorMessage.includes('UsernameExistsException')) {
    return {
      title: 'Account Already Exists',
      message: 'An account with this email already exists. Please sign in instead.'
    };
  }

  // Invalid verification code
  if (errorCode === 'CodeMismatchException' ||
      errorMessage.includes('Invalid verification code') ||
      errorMessage.includes('CodeMismatchException')) {
    return {
      title: 'Invalid Code',
      message: 'The verification code is incorrect. Please check your email and try again.',
      actionRequired: 'resend_code'
    };
  }

  // Code expired
  if (errorCode === 'ExpiredCodeException' ||
      errorMessage.includes('Invalid code provided') ||
      errorMessage.includes('ExpiredCodeException')) {
    return {
      title: 'Code Expired',
      message: 'The verification code has expired. Please request a new one.',
      actionRequired: 'resend_code'
    };
  }

  // Password reset required
  if (errorCode === 'PasswordResetRequiredException' ||
      errorMessage.includes('PasswordResetRequiredException')) {
    return {
      title: 'Password Reset Required',
      message: 'Your password needs to be reset. Please use the "Forgot Password?" option.',
      actionRequired: 'retry'
    };
  }

  // Temporary password
  if (errorCode === 'NewPasswordRequired' ||
      errorMessage.includes('NewPasswordRequired')) {
    return {
      title: 'New Password Required',
      message: 'Please set a new password for your account.',
      actionRequired: 'contact_support'
    };
  }

  // Schema validation errors (from our CLI experience)
  if (errorCode === 'InvalidParameterException' ||
      errorMessage.includes('did not conform to the schema') ||
      errorMessage.includes('not defined in schema')) {
    return {
      title: 'Account Creation Error',
      message: 'There was an issue creating your account. Please try again.',
      actionRequired: 'contact_support'
    };
  }

  // Network/connection errors
  if (errorCode === 'NetworkError' ||
      errorMessage.includes('Network request failed') ||
      errorMessage.includes('NetworkError') ||
      errorMessage.includes('fetch')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      actionRequired: 'retry'
    };
  }

  // Limit exceeded
  if (errorCode === 'LimitExceededException' ||
      errorMessage.includes('Limit exceeded') ||
      errorMessage.includes('LimitExceededException')) {
    return {
      title: 'Limit Exceeded',
      message: 'Too many requests. Please wait a moment before trying again.'
    };
  }

  // Throttling
  if (errorCode === 'ThrottlingException' ||
      errorMessage.includes('ThrottlingException')) {
    return {
      title: 'Too Many Requests',
      message: 'Please wait a moment and try again.'
    };
  }

  // Generic fallback with more debugging info
  console.warn('Unhandled authentication error:', {
    code: errorCode,
    message: errorMessage,
    fullError: error
  });

  return {
    title: 'Authentication Error',
    message: `An unexpected error occurred: ${errorMessage}. Please try again or contact support if the problem persists.`,
    actionRequired: 'retry'
  };
}

/**
 * Helper function to get action button text based on required action
 */
export function getActionButtonText(action?: string): string {
  switch (action) {
    case 'confirm_signup':
      return 'Verify Account';
    case 'resend_code':
      return 'Resend Code';
    case 'retry':
      return 'Try Again';
    case 'contact_support':
      return 'Contact Support';
    default:
      return 'OK';
  }
}
