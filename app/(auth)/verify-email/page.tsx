'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { isValidEmail } from '@/lib/auth-utils';
import Image from 'next/image';


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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
  const [email] = useState(emailParam || '');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // Validation and error states
  const [emailError, setEmailError] = useState('');
  const [isVerificationComplete, setIsVerificationComplete] = useState(false);

  // Initialize component
  useEffect(() => {
    setMounted(true);
    setSupabase(createClient());
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

  // Handle resend email - Supabase handles rate limiting automatically
  const handleResendEmail = async () => {
    if (!supabase) return;
    
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        console.error('Resend error:', error);
        toast.error('Failed to resend email. Please try again.');
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      console.error('Unexpected error during resend:', error);
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Don't render anything if not mounted or has errors
  if (!mounted) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (emailError) {
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

  if (isVerificationComplete) {
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
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-green-600 mb-2">✓</div>
              <h2 className="text-lg font-semibold mb-2">Email Verified!</h2>
              <p className="text-gray-600 mb-4">
                Your email has been successfully verified. Redirecting you to complete your setup...
              </p>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
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
          <CardTitle className="text-center">Verify Your Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              We&apos;ve sent a verification email to:
            </p>
            <p className="font-semibold text-gray-900 mb-6">{email}</p>
            
            {isVerifying ? (
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Verifying...</span>
              </div>
            ) : (
              <div className="mb-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="animate-pulse h-2 w-2 bg-blue-600 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    Waiting for verification...
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  This page will update automatically when you verify your email
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Didn&apos;t receive the email?
              </p>
              <Button
                onClick={handleResendEmail}
                disabled={isResending}
                variant="outline"
                size="sm"
                className="w-full"
              >
                {isResending ? 'Sending...' : 'Resend Email'}
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Wrong email address?
              </p>
              <Button
                onClick={() => router.push('/sign-up')}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                Change Email
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Check your spam folder</strong> if you don&apos;t see the email in your inbox.
                The email should arrive within a few minutes.
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <VerificationErrorBoundary>
      <Suspense fallback={
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
          <Image
            src="/transformo-logo.webp"
            alt="Transformo Logo"
            width={200}
            height={50}
            className="h-auto w-auto"
          />
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <h2 className="text-lg font-semibold">Loading...</h2>
              </div>
            </CardContent>
          </Card>
        </div>
      }>
        <VerificationPageContent />
      </Suspense>
    </VerificationErrorBoundary>
  );
} 