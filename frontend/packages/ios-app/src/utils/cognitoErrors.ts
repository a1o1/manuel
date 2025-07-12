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
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // User not confirmed - needs email verification
  if (errorMessage.includes('User is not confirmed') || 
      errorMessage.includes('UserNotConfirmedException')) {
    return {
      title: 'Account Not Verified',
      message: 'Please check your email and confirm your account before signing in.',
      actionRequired: 'confirm_signup'
    };
  }
  
  // Weak password
  if (errorMessage.includes('Password did not conform') ||
      errorMessage.includes('InvalidPasswordException')) {
    return {
      title: 'Password Too Weak',
      message: 'Password must be at least 8 characters with uppercase, lowercase, numbers, and symbols.'
    };
  }
  
  // User already exists
  if (errorMessage.includes('User already exists') ||
      errorMessage.includes('UsernameExistsException')) {
    return {
      title: 'Account Already Exists',
      message: 'An account with this email already exists. Please sign in instead.'
    };
  }
  
  // Invalid verification code
  if (errorMessage.includes('Invalid verification code') ||
      errorMessage.includes('CodeMismatchException')) {
    return {
      title: 'Invalid Code',
      message: 'The verification code is incorrect. Please check your email and try again.',
      actionRequired: 'resend_code'
    };
  }
  
  // Code expired
  if (errorMessage.includes('Invalid code provided') ||
      errorMessage.includes('ExpiredCodeException')) {
    return {
      title: 'Code Expired',
      message: 'The verification code has expired. Please request a new one.',
      actionRequired: 'resend_code'
    };
  }
  
  // Wrong username or password
  if (errorMessage.includes('Incorrect username or password') ||
      errorMessage.includes('NotAuthorizedException')) {
    return {
      title: 'Sign In Failed',
      message: 'Incorrect email or password. Please check your credentials and try again.'
    };
  }
  
  // Too many attempts
  if (errorMessage.includes('Too many failed attempts') ||
      errorMessage.includes('TooManyRequestsException')) {
    return {
      title: 'Too Many Attempts',
      message: 'Too many failed attempts. Please wait a few minutes before trying again.'
    };
  }
  
  // User not found
  if (errorMessage.includes('User does not exist') ||
      errorMessage.includes('UserNotFoundException')) {
    return {
      title: 'Account Not Found',
      message: 'No account found with this email address. Please check the email or create a new account.'
    };
  }
  
  // Schema validation errors (from our CLI experience)
  if (errorMessage.includes('did not conform to the schema') ||
      errorMessage.includes('not defined in schema')) {
    return {
      title: 'Account Creation Error',
      message: 'There was an issue creating your account. Please try again.',
      actionRequired: 'contact_support'
    };
  }
  
  // Network/connection errors
  if (errorMessage.includes('Network request failed') ||
      errorMessage.includes('NetworkError')) {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection and try again.',
      actionRequired: 'retry'
    };
  }
  
  // Limit exceeded
  if (errorMessage.includes('Limit exceeded') ||
      errorMessage.includes('LimitExceededException')) {
    return {
      title: 'Limit Exceeded',
      message: 'Too many requests. Please wait a moment before trying again.'
    };
  }
  
  // Generic fallback
  return {
    title: 'Authentication Error',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
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