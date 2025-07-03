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
import { isValidEmail, validatePassword, validateName } from '@/lib/auth-utils';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import type { SignupState, PasswordValidation } from '@/types/auth';
import Image from 'next/image';
import Link from 'next/link';

const initialState: SignupState = {};

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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  // Update password validation when password changes
  useEffect(() => {
    const validation = validatePassword(password);
    setPasswordValidation(validation);
  }, [password]);

  // Update form validity
  useEffect(() => {
    const emailValid = isValidEmail(email);
    const firstNameValid = validateName(firstName).isValid;
    const lastNameValid = validateName(lastName).isValid;
    const passwordValid = passwordValidation.isValid;
    
    setIsFormValid(emailValid && firstNameValid && lastNameValid && passwordValid);
  }, [email, firstName, lastName, passwordValidation.isValid]);

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
          <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            
            {/* First Name */}
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter your first name"
                required
                aria-describedby="firstName-error"
              />
              {firstName.length > 0 && !validateName(firstName).isValid && (
                <p id="firstName-error" className="text-sm text-red-600">
                  {validateName(firstName).error}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter your last name"
                required
                aria-describedby="lastName-error"
              />
              {lastName.length > 0 && !validateName(lastName).isValid && (
                <p id="lastName-error" className="text-sm text-red-600">
                  {validateName(lastName).error}
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
              <PasswordRequirements 
                validation={passwordValidation}
                aria-live="polite"
              />
            </div>

            {/* Business Name (Optional) */}
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name (Optional)</Label>
              <Input
                id="businessName"
                name="businessName"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business name"
              />
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

            {/* Sign in link */}
            <div className="text-center text-sm text-gray-600">
              <p>
                Already have an account?{' '}
                <Link href="/sign-in" className="text-blue-600 hover:text-blue-800 underline">
                  Sign in here
                </Link>
              </p>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
} 