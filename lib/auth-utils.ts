import type { PasswordValidation, EmailValidationResult, NameValidationResult } from '@/types/auth';

// ========================================
// SHARED VALIDATION FUNCTIONS
// ========================================

/**
 * Validates email format - used by both signup and forgot password
 */
export const validateEmail = (email: string): EmailValidationResult => {
  const trimmedEmail = email.trim();
  
  if (!trimmedEmail) {
    return { isValid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
};

/**
 * Simple email format check - used in real-time validation
 */
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Validates name format - used by signup
 */
export const validateName = (name: string): NameValidationResult => {
  const trimmedName = name.trim();
  
  if (!trimmedName) {
    return { isValid: false, error: 'Name is required' };
  }
  
  if (trimmedName.length < 2) {
    return { isValid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (trimmedName.length > 100) {
    return { isValid: false, error: 'Name must be less than 100 characters' };
  }
  
  return { isValid: true };
};

/**
 * Password validation - used by both signup and password reset
 * Matches Supabase configuration: 8+ chars, uppercase, lowercase, digit
 */
export const validatePassword = (password: string): PasswordValidation => {
  const requirements = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /\d/.test(password),
  };
  
  const errors: string[] = [];
  if (!requirements.length) errors.push('At least 8 characters');
  if (!requirements.lowercase) errors.push('One lowercase letter');
  if (!requirements.uppercase) errors.push('One uppercase letter');
  if (!requirements.digit) errors.push('One number');
  
  return {
    isValid: errors.length === 0,
    errors,
    requirements,
  };
};

// ========================================
// SHARED UI HELPERS
// ========================================

/**
 * Password requirements component props - used by both features
 */
export interface RequirementItemProps {
  met: boolean;
  children: React.ReactNode;
}

/**
 * Standard loading spinner className for auth forms
 */
export const LOADING_SPINNER_CLASSES = "animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2";

/**
 * Standard error text className for form fields
 */
export const FIELD_ERROR_CLASSES = "text-sm text-red-600";

// ========================================
// SHARED CONSTANTS
// ========================================

export const AUTH_ROUTES = {
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  VERIFY_EMAIL: '/verify-email',
  FORGOT_PASSWORD: '/forgot-password',
  UPDATE_PASSWORD: '/account/update-password',
  TRIAL_SETUP: '/trial-setup',
  AUTH_CALLBACK: '/auth/callback',
  AUTH_CONFIRM: '/auth/confirm',
} as const;

export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  REQUIRE_LOWERCASE: true,
  REQUIRE_UPPERCASE: true,
  REQUIRE_DIGIT: true,
} as const; 