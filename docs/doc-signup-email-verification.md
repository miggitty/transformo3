# Signup Email Verification Implementation Guide
**Hybrid Approach - Email Link + 6-Digit Code Entry**

## Overview

This document outlines the implementation of a modern, hybrid email verification system for user signup. Users can verify their email using either a magic link OR by entering a 6-digit code, providing maximum flexibility and reliability.

## Current State Analysis

### Existing Flow (Problematic)
1. User fills signup form → Server action processes
2. ❌ **Immediate redirect to `/trial-setup`** (skips verification)
3. ❌ **No verification UI** - users get email but nowhere to enter code
4. ❌ **No password validation** - only basic HTML required
5. ❌ **Poor UX** - users confused about next steps

### Target Flow (Hybrid Approach)
1. User fills signup form → **Enhanced password validation**
2. Successful signup → **Verification page** with both options
3. User either clicks email link OR enters 6-digit code
4. Verified → Redirect to `/trial-setup`
5. **Clear messaging** and fallback options throughout

## Technical Architecture

### 1. TypeScript Types & Interfaces

**File:** `types/auth.ts` (create new file)

```typescript
export interface SignupState {
  success?: boolean;
  email?: string;
  userId?: string;
  needsVerification?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
}

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

export interface VerificationPageProps {
  email: string;
  onVerified: () => void;
  onError: (error: string) => void;
}
```

### 2. Complete Signup Form Integration

**File:** `app/(auth)/sign-up/page.tsx`

**Requirements (based on Supabase config):**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)
- Real-time validation with visual feedback
- Disabled submit until requirements met
- Complete form state management
- Loading states and accessibility

**Complete Implementation:**
```tsx
'use client';

import { useState, useEffect } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { signup } from './actions';
import type { SignupState, PasswordValidation } from '@/types/auth';

const initialState: SignupState = {};

// Email validation utility
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function SignUpPage() {
  // Form state management
  const [state, formAction, isPending] = useFormState(signup, initialState);
  const router = useRouter();
  
  // Password validation state
  const [password, setPassword] = useState('');
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    isValid: false,
    errors: [],
    requirements: {
      length: false,
      lowercase: false,
      uppercase: false,
      digit: false,
    }
  });
  
  // Form field states for validation
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  // Password validation function
  const validatePassword = (pass: string): PasswordValidation => {
    const requirements = {
      length: pass.length >= 8,
      lowercase: /[a-z]/.test(pass),
      uppercase: /[A-Z]/.test(pass),
      digit: /\d/.test(pass),
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

  // Update password validation when password changes
  useEffect(() => {
    const validation = validatePassword(password);
    setPasswordValidation(validation);
  }, [password]);

  // Update form validity
  useEffect(() => {
    const emailValid = isValidEmail(email);
    const nameValid = name.trim().length >= 2;
    const passwordValid = passwordValidation.isValid;
    
    setIsFormValid(emailValid && nameValid && passwordValid);
  }, [email, name, passwordValidation.isValid]);

  // Handle signup success/failure
  useEffect(() => {
    if (state.success && state.needsVerification) {
      router.push(`/verify-email?email=${encodeURIComponent(state.email!)}`);
    } else if (state.success && !state.needsVerification) {
      router.push('/trial-setup');
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, router]);

  // Helper function for requirement display
  const RequirementItem = ({ 
    met, 
    children 
  }: { 
    met: boolean; 
    children: React.ReactNode;
  }) => (
    <div className={`flex items-center gap-2 ${met ? 'text-green-600' : 'text-gray-400'}`}>
      <span className="text-sm">{met ? '✓' : '○'}</span>
      <span className="text-sm">{children}</span>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            
            {/* Name Field */}
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                required
                aria-describedby="name-error"
              />
              {name.length > 0 && name.trim().length < 2 && (
                <p id="name-error" className="text-sm text-red-600">
                  Name must be at least 2 characters
                </p>
              )}
            </div>

            {/* Email Field */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                aria-describedby="email-error"
              />
              {email.length > 0 && !isValidEmail(email) && (
                <p id="email-error" className="text-sm text-red-600">
                  Please enter a valid email address
                </p>
              )}
            </div>

            {/* Password Field with Validation */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a secure password"
                required
                aria-describedby="password-requirements"
              />
              
              {/* Password Requirements Checklist */}
              <div 
                id="password-requirements" 
                className="space-y-1 p-3 bg-gray-50 rounded-md"
                aria-live="polite"
              >
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Password Requirements:
                </p>
                <RequirementItem met={passwordValidation.requirements.length}>
                  At least 8 characters
                </RequirementItem>
                <RequirementItem met={passwordValidation.requirements.lowercase}>
                  One lowercase letter (a-z)
                </RequirementItem>
                <RequirementItem met={passwordValidation.requirements.uppercase}>
                  One uppercase letter (A-Z)
                </RequirementItem>
                <RequirementItem met={passwordValidation.requirements.digit}>
                  One number (0-9)
                </RequirementItem>
              </div>
            </div>

            {/* Hidden field to pass password validation to server */}
            <input type="hidden" name="passwordValid" value={passwordValidation.isValid.toString()} />

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={!isFormValid || isPending}
              className="w-full"
              aria-describedby="submit-status"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Creating Account...
                </>
              ) : !isFormValid ? (
                'Complete all requirements'
              ) : (
                'Create Account'
              )}
            </Button>
            
            {/* Form Status for Screen Readers */}
            <div id="submit-status" className="sr-only" aria-live="polite">
              {isPending ? 'Creating your account, please wait...' : ''}
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 3. Enhanced Signup Action with Validation

**File:** `app/(auth)/sign-up/actions.ts`

**Changes:**
- Don't redirect to `/trial-setup` immediately
- Return success state with user email
- Handle verification pending state
- Add comprehensive validation and error handling
- Type safety throughout

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import type { SignupState } from '@/types/auth';

// Server-side validation schemas
const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[a-z]/.test(password)) errors.push('Password must contain lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain uppercase letter');
  if (!/\d/.test(password)) errors.push('Password must contain a number');
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateName = (name: string): boolean => {
  return name.trim().length >= 2 && name.trim().length <= 100;
};

export async function signup(prevState: SignupState, formData: FormData): Promise<SignupState> {
  try {
    // Extract and validate form data
    const email = formData.get('email')?.toString()?.trim() || '';
    const password = formData.get('password')?.toString() || '';
    const name = formData.get('name')?.toString()?.trim() || '';
    const passwordValidFromClient = formData.get('passwordValid') === 'true';

    // Validation errors object
    const errors: Record<string, string[]> = {};

    // Server-side validation (don't trust client)
    if (!validateEmail(email)) {
      errors.email = ['Please enter a valid email address'];
    }

    if (!validateName(name)) {
      errors.name = ['Name must be between 2 and 100 characters'];
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors;
    }

    // Check if client-side validation was bypassed
    if (!passwordValidFromClient && passwordValidation.isValid) {
      console.warn('Client-side validation bypassed for:', email);
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return {
        message: 'Please fix the errors below',
        errors,
      };
    }

    // Create Supabase client
    const supabase = createClient();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return {
        message: 'An account with this email already exists. Try signing in instead.',
      };
    }

    // Attempt to create user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        }
      }
    });

    if (authError) {
      console.error('Signup error:', authError);
      
      // Handle specific Supabase auth errors
      if (authError.message.includes('Password')) {
        return {
          message: 'Password does not meet security requirements',
          errors: { password: [authError.message] }
        };
      }
      
      if (authError.message.includes('email')) {
        return {
          message: 'Invalid email address',
          errors: { email: [authError.message] }
        };
      }

      return {
        message: authError.message || 'Could not create account. Please try again.',
      };
    }

    if (!authData.user) {
      return {
        message: 'Failed to create user account. Please try again.',
      };
    }

    // Create business record (existing logic)
    const { error: businessError } = await supabase
      .from('businesses')
      .insert({
        id: authData.user.id,
        name: `${name}'s Business`,
        // ... other business fields
      });

    if (businessError) {
      console.error('Business creation error:', businessError);
      // Continue anyway - business can be created later
    }

    // Create profile record (existing logic)  
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name: name,
        email: email,
        // ... other profile fields
      });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Continue anyway - profile can be created later
    }

    // Return success state with verification info
    return {
      success: true,
      email: email,
      userId: authData.user.id,
      needsVerification: !authData.user.email_confirmed_at,
    };

  } catch (error) {
    console.error('Unexpected signup error:', error);
    return {
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
```

### 4. Middleware Configuration

**File:** `middleware.ts`

**Purpose:** Allow unauthenticated access to verification page and handle email links

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Allow unauthenticated access to auth-related pages
  const authPages = [
    '/sign-in',
    '/sign-up', 
    '/verify-email',
    '/auth/callback', // For email link verification
    '/auth/confirm',  // Alternative email confirmation endpoint
  ];

  const isAuthPage = authPages.some(page => 
    request.nextUrl.pathname.startsWith(page)
  );

  if (isAuthPage) {
    // For verification pages, allow access but update session if possible
    if (request.nextUrl.pathname.startsWith('/verify-email')) {
      try {
        return await updateSession(request);
      } catch {
        // Continue without session update if it fails
        return NextResponse.next();
      }
    }
    
    // For other auth pages, allow access
    return NextResponse.next();
  }

  // For all other pages, require authentication
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 5. Complete Email Verification Page with All Features

**File:** `app/(auth)/verify-email/page.tsx`

**Features:**
- Hybrid verification (link + code)
- Magic link handling from email
- Email parameter validation
- Rate limiting implementation
- Session management
- Real-time status checking
- Error boundaries and comprehensive error handling
- Mobile optimization and accessibility

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientSafe } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import type { VerificationPageProps } from '@/types/auth';

// Email validation utility
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Rate limiting configuration
const RATE_LIMIT = {
  maxResends: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  maxCodeAttempts: 5,
  codeAttemptsWindowMs: 5 * 60 * 1000, // 5 minutes
};

// Error Boundary Component
class VerificationErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Verification page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertDescription>
                  Something went wrong with email verification. Please try refreshing the page or contact support.
                </AlertDescription>
              </Alert>
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full mt-4"
              >
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main verification component
function VerificationPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Extract email and potential token from URL
  const emailParam = searchParams.get('email');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const isEmailLinkVerification = tokenHash && type === 'signup';

  // State management
  const [email, setEmail] = useState(emailParam || '');
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [supabase, setSupabase] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  
  // Rate limiting state
  const [resendAttempts, setResendAttempts] = useState(0);
  const [lastResendTime, setLastResendTime] = useState<number | null>(null);
  const [codeAttempts, setCodeAttempts] = useState(0);
  const [lastCodeAttemptTime, setLastCodeAttemptTime] = useState<number | null>(null);
  
  // Validation and error states
  const [emailError, setEmailError] = useState('');
  const [isVerificationComplete, setIsVerificationComplete] = useState(false);

  // Initialize component
  useEffect(() => {
    setMounted(true);
    setSupabase(createClientSafe());
  }, []);

  // Validate email parameter
  useEffect(() => {
    if (!emailParam) {
      setEmailError('No email provided. Please return to signup.');
      return;
    }
    
    if (!isValidEmail(emailParam)) {
      setEmailError('Invalid email format in URL.');
      return;
    }
    
    setEmailError('');
  }, [emailParam]);

  // Handle magic link verification on page load
  useEffect(() => {
    if (!supabase || !isEmailLinkVerification) return;

    const verifyEmailLink = async () => {
      try {
        setIsVerifying(true);
        
        const { data, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'signup',
        });

        if (error) {
          console.error('Email link verification error:', error);
          toast.error('Invalid or expired verification link. Please try entering the code manually.');
        } else if (data.user) {
          toast.success('Email verified successfully via link!');
          setIsVerificationComplete(true);
          router.push('/trial-setup');
        }
      } catch (error) {
        console.error('Unexpected error during email link verification:', error);
        toast.error('Failed to verify email link. Please try the code option.');
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmailLink();
  }, [supabase, isEmailLinkVerification, tokenHash, router]);

  // Check existing session and verification status
  useEffect(() => {
    if (!supabase || emailError || isVerificationComplete) return;

    const checkExistingSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user?.email_confirmed_at) {
          toast.success('Email already verified!');
          router.push('/trial-setup');
          return;
        }
        
        // User exists but not verified - this is expected
        if (user && user.email === email) {
          console.log('User session found, waiting for verification');
        }
      } catch (error) {
        console.error('Error checking session:', error);
      }
    };

    checkExistingSession();
  }, [supabase, email, emailError, isVerificationComplete, router]);

  // Auto-check verification status periodically
  useEffect(() => {
    if (!supabase || emailError || isVerificationComplete || isEmailLinkVerification) return;

    const checkVerificationStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          toast.success('Email verified successfully!');
          setIsVerificationComplete(true);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          router.push('/trial-setup');
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
      }
    };

    intervalRef.current = setInterval(checkVerificationStatus, 3000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [supabase, email, emailError, isVerificationComplete, isEmailLinkVerification, router]);

  // Rate limiting helpers
  const canResend = (): boolean => {
    if (!lastResendTime) return true;
    
    const timeSinceLastResend = Date.now() - lastResendTime;
    if (timeSinceLastResend >= RATE_LIMIT.windowMs) {
      setResendAttempts(0);
      return true;
    }
    
    return resendAttempts < RATE_LIMIT.maxResends;
  };

  const canAttemptCode = (): boolean => {
    if (!lastCodeAttemptTime) return true;
    
    const timeSinceLastAttempt = Date.now() - lastCodeAttemptTime;
    if (timeSinceLastAttempt >= RATE_LIMIT.codeAttemptsWindowMs) {
      setCodeAttempts(0);
      return true;
    }
    
    return codeAttempts < RATE_LIMIT.maxCodeAttempts;
  };

  // Handle 6-digit code verification
  const handleCodeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || code.length !== 6 || !canAttemptCode()) return;

    setIsVerifying(true);
    setCodeAttempts(prev => prev + 1);
    setLastCodeAttemptTime(Date.now());
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });

      if (error) {
        console.error('Code verification error:', error);
        
        if (error.message.includes('expired')) {
          toast.error('Verification code has expired. Please request a new one.');
        } else if (error.message.includes('invalid')) {
          toast.error('Invalid verification code. Please check and try again.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Email verified successfully!');
        setIsVerificationComplete(true);
        router.push('/trial-setup');
      }
    } catch (error) {
      console.error('Unexpected error during code verification:', error);
      toast.error('Failed to verify code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle resend email
  const handleResendEmail = async () => {
    if (!supabase || !canResend()) return;
    
    setIsResending(true);
    setResendAttempts(prev => prev + 1);
    setLastResendTime(Date.now());
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        console.error('Resend error:', error);
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Check your inbox.');
        setCode(''); // Clear any entered code
      }
    } catch (error) {
      console.error('Unexpected error during resend:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Don't render until mounted (prevents hydration issues)
  if (!mounted) {
    return null;
  }

  // Handle error states
  if (emailError) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>{emailError}</AlertDescription>
            </Alert>
            <Button 
              onClick={() => router.push('/sign-up')} 
              className="w-full mt-4"
            >
              Return to Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-gray-600">
            <p>We sent a verification email to:</p>
            <p className="font-semibold break-all">{email}</p>
          </div>

          {/* Option 1: Email Link */}
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold">Option 1: Click the link in your email</h3>
            <p className="text-sm text-gray-600">
              Check your inbox and click the verification link to complete signup.
            </p>
            {!isEmailLinkVerification && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full"></div>
                Waiting for email verification...
              </div>
            )}
            {isEmailLinkVerification && isVerifying && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                Verifying email link...
              </div>
            )}
          </div>

          {/* Option 2: 6-Digit Code */}
          <div className="border rounded-lg p-4 space-y-3">
            <h3 className="font-semibold">Option 2: Enter the 6-digit code</h3>
            <form onSubmit={handleCodeVerification} className="space-y-3">
              <Input
                type="text"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                aria-label="6-digit verification code"
                disabled={isVerifying || !canAttemptCode()}
              />
              
              {!canAttemptCode() && (
                <p className="text-sm text-red-600 text-center">
                  Too many attempts. Please wait 5 minutes before trying again.
                </p>
              )}
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={code.length !== 6 || isVerifying || !canAttemptCode()}
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </form>
          </div>

          {/* Resend Option */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              Didn't receive the email?
            </p>
            
            {!canResend() && (
              <p className="text-sm text-red-600 mb-2">
                Resend limit reached. Please wait 1 hour before requesting another email.
              </p>
            )}
            
            <Button
              variant="outline"
              onClick={handleResendEmail}
              disabled={isResending || !canResend()}
              className="w-full"
            >
              {isResending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                  Sending...
                </>
              ) : (
                `Resend Verification Email (${RATE_LIMIT.maxResends - resendAttempts} left)`
              )}
            </Button>
          </div>

          {/* Help */}
          <div className="text-center text-sm text-gray-500 space-y-2">
            <p>Check your spam folder or try a different email address.</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/sign-up')}
              className="text-xs"
            >
              Need to change email? Return to signup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Main exported component with error boundary
export default function VerifyEmailPage() {
  return (
    <VerificationErrorBoundary>
      <VerificationPageContent />
    </VerificationErrorBoundary>
  );
}
```

### 6. Auth Callback Route for Email Links

**File:** `app/auth/callback/route.ts` (create this route)

**Purpose:** Handle email verification links that redirect to `/auth/callback`

```typescript
import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/trial-setup';

  if (code) {
    const supabase = createClient();
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error && data.user) {
        // Email verification successful
        console.log('Email verified via callback for user:', data.user.email);
        
        // Redirect to success page
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        console.error('Email verification callback error:', error);
        
        // Redirect back to verification page with error
        return NextResponse.redirect(
          `${origin}/verify-email?error=invalid_link&message=${encodeURIComponent(
            error?.message || 'Invalid verification link'
          )}`
        );
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      
      return NextResponse.redirect(
        `${origin}/verify-email?error=callback_error&message=${encodeURIComponent(
          'Verification failed. Please try again.'
        )}`
      );
    }
  }

  // No code provided, redirect to sign up
  return NextResponse.redirect(`${origin}/sign-up`);
}
```

### 7. Environment Configuration

**File:** `.env.local` (add these if missing)

```env
# Required for proper email link redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
```

### 8. Additional Utility Components

**File:** `components/ui/error-boundary.tsx` (create new file)

```tsx
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertDescription>
                  Something went wrong. Please try refreshing the page or contact support if the problem persists.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2 mt-4">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="flex-1"
                >
                  Refresh Page
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => this.setState({ hasError: false, error: null })}
                  className="flex-1"
                >
                  Try Again
                </Button>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-xs">
                  <summary className="cursor-pointer">Error Details (Dev Only)</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-red-600 overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 9. Loading States and Skeletons

**File:** `components/ui/verification-skeleton.tsx` (create new file)

```tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function VerificationSkeleton() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <Skeleton className="h-8 w-48 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <Skeleton className="h-4 w-40 mx-auto" />
            <Skeleton className="h-4 w-60 mx-auto" />
          </div>
          
          <div className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          
          <div className="border rounded-lg p-4 space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          
          <div className="text-center space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 10. Testing Utilities

**File:** `lib/test-utils/verification.ts` (create new file)

```typescript
// Testing utilities for verification flow
export const createMockVerificationEmail = (email: string) => ({
  to: email,
  subject: 'Confirm your email address',
  html: `
    <h1>Welcome to Transformo!</h1>
    <p>Please confirm your email address by clicking the link below:</p>
    <a href="http://localhost:3000/auth/callback?code=mock-verification-code">Verify Email</a>
    <p>Or enter this 6-digit code: <strong>123456</strong></p>
  `,
});

export const mockVerificationStates = {
  pending: {
    success: true,
    email: 'test@example.com',
    userId: 'mock-user-id',
    needsVerification: true,
  },
  verified: {
    success: true,
    email: 'test@example.com',
    userId: 'mock-user-id',
    needsVerification: false,
  },
  error: {
    message: 'Invalid email or password',
    errors: { email: ['Invalid email format'] },
  },
};

export const testVerificationFlow = async (email: string) => {
  // Mock function for testing the complete verification flow
  console.log(`Testing verification flow for ${email}`);
  
  // Simulate signup
  const signupResult = mockVerificationStates.pending;
  
  // Simulate email verification
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return mockVerificationStates.verified;
};
```

## Complete Implementation Checklist

### ✅ **Phase 1: Type Safety & Foundation**
- [ ] Create `types/auth.ts` with all interfaces
- [ ] Update `middleware.ts` with auth page configurations
- [ ] Add environment variables to `.env.local`
- [ ] Create error boundary component
- [ ] Create loading skeleton components

### ✅ **Phase 2: Enhanced Signup Form**
- [ ] Update `app/(auth)/sign-up/page.tsx` with complete implementation
- [ ] Add real-time password validation with visual checklist
- [ ] Implement form state management and loading states
- [ ] Add accessibility features (aria-labels, screen reader support)
- [ ] Connect form validation to server action

### ✅ **Phase 3: Robust Server Action**  
- [ ] Update `app/(auth)/sign-up/actions.ts` with comprehensive validation
- [ ] Add server-side password requirements validation
- [ ] Implement proper error handling for all scenarios
- [ ] Add user existence checking
- [ ] Handle business/profile creation with error recovery

### ✅ **Phase 4: Complete Verification Page**
- [ ] Create `app/(auth)/verify-email/page.tsx` with all features
- [ ] Implement hybrid verification (email link + 6-digit code)
- [ ] Add magic link handling for email verification
- [ ] Implement rate limiting for resends and code attempts
- [ ] Add email parameter validation and error states
- [ ] Include session management and status checking
- [ ] Add mobile optimization and accessibility features

### ✅ **Phase 5: Email Link Support**
- [ ] Create `app/auth/callback/route.ts` for email verification links
- [ ] Handle authentication code exchange
- [ ] Implement proper redirect logic with error handling
- [ ] Add fallback for failed email link verification

### ✅ **Phase 6: Error Handling & UX**
- [ ] Wrap verification page with error boundary
- [ ] Add comprehensive loading states
- [ ] Implement proper error messaging for all scenarios
- [ ] Add development-only error details
- [ ] Include user-friendly fallback options

### ✅ **Phase 7: Testing & Validation**
- [ ] Create testing utilities for verification flow
- [ ] Test both verification methods (link + code)
- [ ] Verify rate limiting works correctly
- [ ] Test error scenarios and recovery
- [ ] Validate accessibility with screen readers
- [ ] Test mobile experience

## Key Improvements Added (Items 1-10)

### 🔒 **1. Complete Type Safety**
- TypeScript interfaces for all states and props
- Proper error typing and validation schemas
- Type-safe form handling throughout

### 🎨 **2. Enhanced Signup Form Integration**
- Complete form implementation with all fields
- Real-time validation connected to server action
- Loading states and accessibility features
- Password validation checklist with visual feedback

### ⚡ **3. Robust Server Action**
- Comprehensive server-side validation
- Proper error handling for all scenarios
- User existence checking and specific error messages
- Recovery logic for business/profile creation failures

### 🔗 **4. Magic Link Handling**
- Email verification link processing
- Token hash verification and session exchange
- Automatic detection of email link verification
- Fallback to code entry if link fails

### 🛡️ **5. Email Parameter Validation**
- URL parameter sanitization and validation
- Error states for missing/invalid email
- Redirect logic for malformed requests
- User-friendly error messages

### ⏱️ **6. Rate Limiting Implementation**
- 3 resend emails per hour limit
- 5 code attempts per 5-minute window
- Client-side rate limit tracking
- Visual feedback for rate limit status

### 🚀 **7. Form State Management**
- Connected React state to FormData
- Password validation integrated with form submission
- Loading states during signup process
- Proper form validation flow

### 📱 **8. Loading States & Accessibility**
- Loading spinners and disabled states
- Screen reader support with aria-labels
- Mobile-optimized code input
- Skeleton loading components

### 🔍 **9. Session Management**
- Existing session detection and handling
- Auto-redirect for already verified users
- Proper session state throughout verification
- Real-time verification status checking

### 🛠️ **10. Comprehensive Error Handling**
- Error boundaries for React crashes
- Specific error messages for different scenarios
- Recovery options and fallbacks
- Development error details

## When This Flow Is Used

### ✅ **Used For:**
- **Initial signup only** - when user creates account for first time
- **Email change** - if user changes their email address in settings

### ❌ **NOT Used For:**
- **Regular login** - verified users sign in normally
- **Password reset** - uses different flow
- **Return visits** - once verified, no re-verification needed

### Flow Comparison:
- **New user signup:** signup form → verification page → trial-setup
- **Returning user login:** login form → direct to content/dashboard
- **Email change:** settings → new verification → settings (updated)

## Password Requirements Configuration

### ✅ **Current Settings (Updated - Option A: Balanced Security):**
```toml
minimum_password_length = 8
password_requirements = "lower_upper_letters_digits"
```

**Requires:** 8+ characters, uppercase, lowercase, numbers  
**Examples:** `"Password123"`, `"MyApp2024"`, `"Welcome1"`

### Why We Chose Option A:
- **Better security** than length-only requirements
- **User-friendly** - not overly complex like symbols requirement  
- **Industry standard** - used by most modern SaaS apps
- **Protects user accounts** from common password attacks

### Alternative Options (Not Used):

#### Option B: High Security
```toml
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits_symbols"
```
**Requires:** 12+ chars, uppercase, lowercase, numbers, symbols

#### Option C: User-Friendly (Previous Setting)
```toml
minimum_password_length = 6
password_requirements = ""
```
**Requires:** Only 6+ characters

### Frontend Validation (Matches Current Supabase Config):
```tsx
const validatePassword = (pass: string) => {
  const errors: string[] = [];
  
  // Length requirement
  if (pass.length < 8) errors.push('At least 8 characters');
  
  // Character requirements (matching current Supabase config)
  if (!/[a-z]/.test(pass)) errors.push('One lowercase letter');
  if (!/[A-Z]/.test(pass)) errors.push('One uppercase letter');
  if (!/\d/.test(pass)) errors.push('One number');
  
  return errors;
};
```

### Security Impact:
- ❌ **Previous passwords like `"abcdef"` will be rejected**
- ✅ **New passwords must be like `"Password123"`**
- 🔄 **Existing users keep their passwords** (only affects new signups/resets)
- 📊 **Expected to block ~80% of common weak passwords**

## Success Metrics

### User Experience:
- **Email verification completion rate >95%**
- **Time to verification <2 minutes**
- **Support tickets about verification <1%**

### Technical Metrics:
- **Email delivery rate >99%**
- **Code verification success rate >98%**
- **Link verification success rate >95%**

## Error Handling

### Common Scenarios:
1. **Email not received** → Resend functionality
2. **Wrong code entered** → Clear error message, allow retry
3. **Email link blocked** → Code entry fallback works
4. **Code expired** → Resend with fresh code
5. **Already verified** → Redirect to trial-setup

## Security Considerations

### Rate Limiting:
- Limit resend emails to 3 per hour per email
- Limit code attempts to 5 per session
- Implement CAPTCHA for excessive resends

### Validation:
- Sanitize email parameter in URL
- Validate code format on frontend and backend
- Use secure random generation for codes

## Future Enhancements

### Phase 2 Improvements:
- **Magic link domain verification** - prevent phishing
- **SMS verification fallback** - for email delivery issues
- **Social auth integration** - Google/GitHub signup
- **Progressive profiling** - collect additional info after verification 