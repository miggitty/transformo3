# Auth System Implementation Guide
**Complete Authentication Flow - Signup Verification + Forgot Password**

## Overview

This guide shows how to implement **both signup email verification and forgot password** features together as a cohesive authentication system. Both features share components and follow identical patterns.

## Implementation Order (No Conflicts)

### 🔄 **Phase 1: Shared Foundation (45 minutes)**
Create shared code that both features will use:

1. **Merged TypeScript types**
2. **Shared validation utilities**  
3. **Updated middleware configuration**
4. **Common UI patterns**

### 🔄 **Phase 2: Feature Implementation (Parallel)**
Both features can be implemented **simultaneously** or **in any order**:

**Option A:** Implement both at once (5.5 hours total)
**Option B:** Implement signup verification first (3 hours), then forgot password (2.5 hours)  
**Option C:** Implement forgot password first (2.5 hours), then signup verification (3 hours)

### 🔄 **Phase 3: Integration Testing (30 minutes)**
Test both flows work together without conflicts.

---

## Phase 1: Shared Foundation

### 1. Merged TypeScript Types

**File:** `types/auth.ts` (create new file)

```typescript
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
```

### 2. Shared Validation Utilities

**File:** `lib/auth-utils.ts` (create new file)

```typescript
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
 * Standard loading spinner component for auth forms
 */
export const getLoadingSpinner = () => (
  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
);

/**
 * Standard form field error display
 */
export const getFieldError = (error: string) => (
  <p className="text-sm text-red-600">{error}</p>
);

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
```

### 3. Shared UI Components

**File:** `components/auth/password-requirements.tsx` (create new file)

```tsx
'use client';

import type { PasswordValidation } from '@/types/auth';

interface RequirementItemProps {
  met: boolean;
  children: React.ReactNode;
}

const RequirementItem = ({ met, children }: RequirementItemProps) => (
  <div className={`flex items-center gap-2 ${met ? 'text-green-600' : 'text-gray-400'}`}>
    <span className="text-sm">{met ? '✓' : '○'}</span>
    <span className="text-sm">{children}</span>
  </div>
);

interface PasswordRequirementsProps {
  validation: PasswordValidation;
  className?: string;
}

export function PasswordRequirements({ validation, className = '' }: PasswordRequirementsProps) {
  return (
    <div className={`space-y-1 p-3 bg-gray-50 rounded-md ${className}`}>
      <p className="text-sm font-medium text-gray-700 mb-2">
        Password Requirements:
      </p>
      <RequirementItem met={validation.requirements.length}>
        At least 8 characters
      </RequirementItem>
      <RequirementItem met={validation.requirements.lowercase}>
        One lowercase letter (a-z)
      </RequirementItem>
      <RequirementItem met={validation.requirements.uppercase}>
        One uppercase letter (A-Z)
      </RequirementItem>
      <RequirementItem met={validation.requirements.digit}>
        One number (0-9)
      </RequirementItem>
    </div>
  );
}
```

### 4. Updated Middleware Configuration

**File:** `middleware.ts` (update existing)

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { AUTH_ROUTES } from '@/lib/auth-utils';

export async function middleware(request: NextRequest) {
  // Combined auth pages from both features
  const authPages = [
    AUTH_ROUTES.SIGN_IN,
    AUTH_ROUTES.SIGN_UP,
    AUTH_ROUTES.VERIFY_EMAIL,        // From signup verification
    AUTH_ROUTES.FORGOT_PASSWORD,     // From forgot password
    AUTH_ROUTES.UPDATE_PASSWORD,     // From forgot password
    AUTH_ROUTES.AUTH_CALLBACK,       // For email links
    AUTH_ROUTES.AUTH_CONFIRM,        // Alternative callback
  ];

  const isAuthPage = authPages.some(page => 
    request.nextUrl.pathname.startsWith(page)
  );

  if (isAuthPage) {
    // Special handling for verification and password reset pages
    if (request.nextUrl.pathname.startsWith(AUTH_ROUTES.VERIFY_EMAIL) ||
        request.nextUrl.pathname.startsWith(AUTH_ROUTES.UPDATE_PASSWORD)) {
      try {
        return await updateSession(request);
      } catch {
        // Continue without session update if it fails
        return NextResponse.next();
      }
    }
    
    // For other auth pages, allow unauthenticated access
    return NextResponse.next();
  }

  // For all other pages, require authentication
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## Phase 2: Feature Implementation

### Implementation Options

**Option A: Implement Both Features Simultaneously (Recommended)**
- Multiple developers can work on different features
- Shared foundation already in place
- Total time: ~5.5 hours

**Option B: Signup Verification First**
- Start with signup verification (3 hours)
- Then add forgot password (2.5 hours)  
- Good for user onboarding priority

**Option C: Forgot Password First**
- Start with forgot password (2.5 hours)
- Then add signup verification (3 hours)
- Good for existing user support priority

### Feature-Specific Implementation

**For Signup Verification:** Follow `doc-signup-email-verification.md` but:
- Import types from `types/auth.ts`
- Import utilities from `lib/auth-utils.ts`
- Use `PasswordRequirements` component

**For Forgot Password:** Follow `doc-forgot-password.md` but:
- Import types from `types/auth.ts` 
- Import utilities from `lib/auth-utils.ts`
- Use `PasswordRequirements` component

---

## Phase 3: Integration Testing

### Test Scenarios

#### 1. **Independent Flow Testing**
- [ ] Signup → verification → trial setup (without conflicts)
- [ ] Forgot password → reset → sign in (without conflicts)

#### 2. **Cross-Feature Testing**
- [ ] User signs up → verifies → later forgets password → resets successfully
- [ ] User starts signup verification → interrupts → uses forgot password → works correctly
- [ ] Multiple auth pages accessible simultaneously (no middleware conflicts)

#### 3. **Shared Component Testing**
- [ ] Password requirements component works in both signup and reset
- [ ] Validation utilities work consistently across features
- [ ] Error handling consistent across both flows

### Integration Verification Checklist

#### ✅ **Code Integration**
- [ ] No TypeScript compilation errors
- [ ] No import/export conflicts
- [ ] Middleware handles all auth routes correctly
- [ ] Shared utilities work in both features

#### ✅ **User Experience**
- [ ] Consistent password validation across signup and reset
- [ ] Consistent error messaging and loading states
- [ ] Consistent visual design and branding
- [ ] Responsive design works on all auth pages

#### ✅ **Security**
- [ ] Both features use Supabase built-in rate limiting
- [ ] Password validation matches Supabase configuration
- [ ] No token/session conflicts between features
- [ ] Email enumeration protection in both flows

---

## File Changes Summary

### New Files to Create:
```
types/auth.ts                           # Merged TypeScript types
lib/auth-utils.ts                       # Shared validation utilities  
components/auth/password-requirements.tsx # Shared password UI component
docs/auth-system-implementation-guide.md  # This file
```

### Files to Update:
```
middleware.ts                           # Add all auth routes
```

### Feature-Specific Files (from individual PRDs):
```
# Signup Verification (from doc-signup-email-verification.md)
app/(auth)/sign-up/page.tsx             # Enhanced signup form
app/(auth)/sign-up/actions.ts           # Enhanced signup action
app/(auth)/verify-email/page.tsx        # Email verification page
app/auth/callback/route.ts              # Email link handler

# Forgot Password (from doc-forgot-password.md)  
app/(auth)/sign-in/page.tsx             # Add forgot password link
app/(auth)/forgot-password/page.tsx     # Forgot password form
app/(auth)/forgot-password/actions.ts   # Forgot password action
app/account/update-password/page.tsx    # Password reset page
```

---

## Benefits of This Approach

### ✅ **No Conflicts**
- Separate routes for each feature
- Shared foundation prevents duplication
- Clear implementation order

### ✅ **Maintainable**
- Single source of truth for validation logic
- Consistent UI patterns across features
- TypeScript ensures compatibility

### ✅ **Flexible**
- Can implement features in any order
- Can deploy features independently
- Easy to extend with additional auth features

### ✅ **Production Ready**
- Both features use Supabase built-in capabilities
- Comprehensive error handling
- Security best practices

---

## Next Steps

1. **Create shared foundation files** (Phase 1)
2. **Choose implementation option** (A, B, or C)
3. **Implement chosen features** following individual PRDs
4. **Run integration tests** to verify everything works together

Would you like me to proceed with creating these shared foundation files? 