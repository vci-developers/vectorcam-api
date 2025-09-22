/**
 * Password validation utility functions
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates basic password format requirements
 * @param password - The password to validate
 * @returns PasswordValidationResult with validation status and error messages
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check if password is provided
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { isValid: false, errors };
  }

  // Length requirement
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be no more than 128 characters long');
  }

  // No leading/trailing whitespace
  if (password !== password.trim()) {
    errors.push('Password cannot have leading or trailing spaces');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Email validation utility function
 * @param email - The email to validate
 * @returns boolean indicating if email is valid
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254; // RFC 5321 limit
}

/**
 * Validates if a string represents a valid positive integer ID
 * @param id - The ID string to validate
 * @returns boolean indicating if ID is valid
 */
export function isValidId(id: string): boolean {
  return !isNaN(Number(id)) && Number(id) > 0 && Number.isInteger(Number(id));
}
