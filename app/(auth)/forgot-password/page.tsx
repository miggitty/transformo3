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