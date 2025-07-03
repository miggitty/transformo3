# Forgot Password Implementation PRD
**Email Link Only - Simple & Secure**

## Overview

This document outlines the implementation of a clean, simple forgot password feature for Transformo. The solution uses **email link verification only** with Supabase's built-in rate limiting for security and simplicity.

## Current State Analysis

### ✅ **Existing Infrastructure** 
- **Supabase Auth**: Configured with `resetPasswordForEmail()` API
- **Email Template**: Recovery template exists (`supabase/templates/recovery_template.html`)
- **SMTP Configuration**: Resend integration configured for production
- **Route Structure**: Empty directories exist for password reset flow
- **Middleware**: Auth protection and session management in place

### ❌ **Missing Implementation**
- **Forgot Password Link**: Not present on sign-in page
- **Forgot Password Page**: `/forgot-password` route doesn't exist
- **Reset Password Page**: `/account/update-password` is empty
- **Auth Callback Handler**: `/auth/confirm` route is empty
- **Server Actions**: No forgot password actions implemented

### 📋 **Dependencies**
- **No dependencies**: Signup email verification not implemented yet, so this is standalone
- **Uses existing**: UI components, auth middleware, email infrastructure

## Technical Architecture

### 🔄 **User Flow**
1. User clicks **"Forgot Password?"** on sign-in page
2. User enters email on **`/forgot-password`** page
3. Server sends email via **`supabase.auth.resetPasswordForEmail()`**
4. User clicks email link → redirected to **`/account/update-password`** 
5. User sets new password → success message → redirect to sign-in

### 🔒 **Security Features**
- **Rate limiting**: Supabase built-in (typically 3-5 emails per hour per address)
- **Email enumeration protection**: Always show success regardless of email existence
- **Token security**: 1-hour expiration, one-time use tokens
- **Session invalidation**: Other sessions logged out after password change
- **Password validation**: 8+ chars, uppercase, lowercase, digit (matching signup)

## Implementation Plan

### 1. TypeScript Types

**File:** `types/auth.ts` (✅ **Already created in shared foundation**)

**Note:** All TypeScript types are available in the shared `types/auth.ts` file. Import what you need:

```typescript
import type { 
  ForgotPasswordState, 
  ResetPasswordState, 
  PasswordValidation 
} from '@/types/auth';
```

**Available interfaces:**
- `ForgotPasswordState` - For forgot password form state
- `ResetPasswordState` - For password reset page state  
- `PasswordValidation` - For password requirement validation

### 2. Add Forgot Password Link to Sign-in

**File:** `app/(auth)/sign-in/page.tsx`

**Modification:** Add link after password field, before submit button:

```tsx
// Add after password input
<div className="text-right mb-4">
  <Link 
    href="/forgot-password" 
    className="text-sm text-blue-600 hover:text-blue-800 underline"
  >
    Forgot your password?
  </Link>
</div>
```

### 3. Forgot Password Request Page

**File:** `app/(auth)/forgot-password/page.tsx` (create new)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useFormState } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { requestPasswordReset } from './actions';
import { isValidEmail } from '@/lib/auth-utils';
import type { ForgotPasswordState } from '@/types/auth';

const initialState: ForgotPasswordState = {
  message: '',
};

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useFormState(requestPasswordReset, initialState);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (state.success) {
      setEmailSent(true);
      toast.success('Password reset email sent! Check your inbox.');
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state]);

  if (emailSent) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
        <Image
          src="/transformo-logo.webp"
          alt="Transformo Logo"
          width={200}
          height={50}
          className="h-auto w-auto"
        />
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertDescription>
                We've sent a password reset link to <strong>{state.email}</strong>. 
                Click the link in the email to reset your password.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2 text-sm text-gray-600">
              <p>• The link will expire in 1 hour</p>
              <p>• Check your spam folder if you don't see the email</p>
              <p>• You can request a new link if needed</p>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEmailSent(false)} className="flex-1">
                Send Another Email
              </Button>
              <Button asChild className="flex-1">
                <Link href="/sign-in">Back to Sign In</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Image
        src="/transformo-logo.webp"
        alt="Transformo Logo"
        width={200}
        height={50}
        className="h-auto w-auto"
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Reset Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="w-full"
              />
              {email && !isValidEmail(email) && (
                <p className="text-sm text-red-600">Please enter a valid email address</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={!isValidEmail(email) || isPending}
              className="w-full"
            >
              {isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Sending Email...
                </>
              ) : (
                'Send Reset Email'
              )}
            </Button>

            <div className="text-center text-sm text-gray-600">
              <p>
                Remember your password?{' '}
                <Link href="/sign-in" className="text-blue-600 hover:text-blue-800 underline">
                  Sign in instead
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 4. Forgot Password Server Action

**File:** `app/(auth)/forgot-password/actions.ts` (create new)

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { isValidEmail } from '@/lib/auth-utils';
import type { ForgotPasswordState } from '@/types/auth';

export async function requestPasswordReset(
  prevState: ForgotPasswordState, 
  formData: FormData
): Promise<ForgotPasswordState> {
  try {
    const email = formData.get('email')?.toString()?.trim();

    if (!email || !isValidEmail(email)) {
      return {
        message: 'Please enter a valid email address',
        errors: { email: ['Invalid email format'] },
      };
    }

    const supabase = createClient();

    // Use Supabase's built-in password reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/account/update-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      
      // Handle specific Supabase errors
      if (error.message.includes('Email rate limit')) {
        return {
          message: 'Too many password reset attempts. Please try again later.',
        };
      }
      
      // For security, don't reveal specific errors to prevent email enumeration
      // Always show success message in UI regardless of whether email exists
    }

    // Always return success to prevent email enumeration attacks
    return {
      success: true,
      email: email,
      message: 'Password reset email sent successfully',
    };

  } catch (error) {
    console.error('Unexpected error in password reset:', error);
    return {
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
```

### 5. Password Update Page (handles email link)

**File:** `app/account/update-password/page.tsx` (create new)

```tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { validatePassword } from '@/lib/auth-utils';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import type { PasswordValidation } from '@/types/auth';

function UpdatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    isValid: false,
    errors: [],
    requirements: { length: false, lowercase: false, uppercase: false, digit: false },
  });

  // Validate password in real-time
  useEffect(() => {
    setPasswordValidation(validatePassword(password));
  }, [password]);

  // Check for valid password reset session
  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setIsValidSession(true);
      } else {
        // Check if this is from a password reset link
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          try {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (!error) {
              setIsValidSession(true);
            } else {
              toast.error('Invalid or expired password reset link');
              router.push('/forgot-password');
            }
          } catch (error) {
            toast.error('Invalid password reset link');
            router.push('/forgot-password');
          }
        } else {
          toast.error('Invalid password reset link');
          router.push('/forgot-password');
        }
      }
    };

    checkSession();
  }, [searchParams, router]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!passwordValidation.isValid) {
      toast.error('Password does not meet requirements');
      return;
    }
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password updated successfully!');
        
        // Sign out all other sessions for security
        await supabase.auth.signOut({ scope: 'others' });
        
        // Redirect to sign-in
        router.push('/sign-in?message=Password updated successfully. Please sign in with your new password.');
      }
    } catch (error) {
      toast.error('Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>
                Checking password reset session...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Image
        src="/transformo-logo.webp"
        alt="Transformo Logo"
        width={200}
        height={50}
        className="h-auto w-auto"
      />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Set New Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password"
                required
                className="w-full"
              />
              
              {/* Password Requirements */}
              <PasswordRequirements validation={passwordValidation} />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
                className="w-full"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-sm text-red-600">Passwords do not match</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={!passwordValidation.isValid || password !== confirmPassword || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <UpdatePasswordContent />
    </Suspense>
  );
}
```

### 6. Update Middleware for New Routes

**File:** `middleware.ts` (✅ **Already updated in shared foundation**)

**Note:** The middleware has been updated to include forgot password routes in the `BYPASS_ROUTES` array:
- `/forgot-password` - For password reset request page
- `/account/update-password` - For password reset form page  
- `/auth/callback` - For email link handling
- `/auth/confirm` - Alternative callback endpoint

No additional middleware changes needed.

## Implementation Checklist

### ✅ **Phase 1: Foundation (30 minutes)**
- [ ] Create `types/auth.ts` with password reset interfaces
- [ ] Add "Forgot Password?" link to sign-in page
- [ ] Update middleware to allow new routes

### ✅ **Phase 2: Request Flow (45 minutes)**
- [ ] Create `/forgot-password` page with email form
- [ ] Create forgot password server action
- [ ] Test email sending with Supabase auth

### ✅ **Phase 3: Reset Flow (45 minutes)**
- [ ] Create `/account/update-password` page
- [ ] Implement password validation with visual feedback
- [ ] Handle email link parameters and session setup
- [ ] Test complete password reset flow

### ✅ **Phase 4: Polish & Security (30 minutes)**
- [ ] Add error handling and loading states
- [ ] Test rate limiting behavior
- [ ] Verify email enumeration protection
- [ ] Test on mobile devices

## Testing Strategy

### 🧪 **Manual Testing**
1. **Happy Path**: Enter email → receive email → click link → set password → sign in
2. **Invalid Email**: Test with malformed email addresses
3. **Rate Limiting**: Try multiple requests to same email quickly
4. **Expired Links**: Wait >1 hour and test expired link behavior
5. **Mobile**: Test responsive design on mobile devices

### 🔒 **Security Testing**
1. **Email Enumeration**: Verify identical response for existing/non-existing emails
2. **Token Validation**: Test with invalid/expired tokens
3. **Session Security**: Verify other sessions are invalidated after password change
4. **Password Requirements**: Test password validation edge cases

## Success Metrics

### 📊 **User Experience**
- **Password reset completion rate >90%**
- **Time to complete reset <5 minutes**
- **Support tickets about password reset <1% of total**

### 🔒 **Security Metrics**
- **No email enumeration vulnerabilities**
- **Rate limiting functioning properly**
- **No token reuse possible**
- **Password requirements enforced consistently**

## Future Enhancements

### 🚀 **Phase 2 Improvements**
- **Password strength meter** - visual indicator of password security
- **Recent passwords prevention** - don't allow reusing last 3 passwords
- **Account lockout** - temporary lockout after too many failed attempts
- **Email templates customization** - branded password reset emails
- **Audit logging** - track all password reset attempts for security monitoring

---

**Implementation Notes:**
- Uses Supabase's built-in rate limiting (no additional infrastructure needed)
- Email link only approach (simpler than hybrid)
- Follows existing UI/UX patterns from the app
- Independent of signup email verification (can be implemented anytime)
- Ready for production with proper security measures
