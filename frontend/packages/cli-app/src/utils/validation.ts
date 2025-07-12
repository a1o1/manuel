// Email validation
export function validateEmail(email: string): boolean | string {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }
  return true;
}

// Password validation
export function validatePassword(password: string): boolean | string {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }

  if (!/(?=.*[a-z])/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }

  if (!/(?=.*\d)/.test(password)) {
    return 'Password must contain at least one number';
  }

  return true;
}

// URL validation
export function validateUrl(url: string): boolean | string {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      return 'Only HTTPS URLs are allowed';
    }
    return true;
  } catch {
    return 'Please enter a valid URL';
  }
}

// File path validation
export function validateFilePath(path: string): boolean | string {
  if (!path || path.trim().length === 0) {
    return 'Please enter a file path';
  }

  // Basic path validation
  if (path.includes('..')) {
    return 'Path traversal not allowed';
  }

  return true;
}
