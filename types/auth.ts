// ========================================
// SHARED TYPES FOR BOTH FEATURES
// ========================================

// Signup verification types
export interface SignupState {
  success?: boolean;
  email?: string;
  userId?: string;
  needsVerification?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

// Forgot password types
export interface ForgotPasswordState {
  success?: boolean;
  email?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface ResetPasswordState {
  success?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  tokenValid?: boolean;
}

// Shared password validation (used by both features)
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  requirements: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    digit: boolean;
  };
}

// Email verification specific
export interface VerificationPageProps {
  email: string;
  onVerified: () => void;
  onError: (error: string) => void;
}

// ========================================
// SHARED VALIDATION SCHEMAS
// ========================================

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export interface NameValidationResult {
  isValid: boolean;
  error?: string;
} 