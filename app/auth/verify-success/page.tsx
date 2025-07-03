'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export default function VerifySuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const verifyAndRedirect = async () => {
      const token_hash = searchParams.get('token_hash');
      const type = searchParams.get('type');
      const verified = searchParams.get('verified');

      // If already verified via code, skip verification and go straight to success
      if (verified === 'true') {
        console.log('Email already verified via code, showing success');
        setStatus('success');
        toast.success('Email verified successfully!');

        // Start countdown timer
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              // Redirect to trial setup
              router.push('/trial-setup');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(timer);
      }

      if (!token_hash || !type) {
        setStatus('error');
        return;
      }

      try {
        const supabase = createClient()!;
        
        // Verify the email on the client side for better session management
        const { data, error } = await supabase.auth.verifyOtp({
          type: type as any,
          token_hash,
        });

        if (error) {
          console.error('Client-side verification error:', error);
          setStatus('error');
          toast.error('Email verification failed');
          return;
        }

        if (data.user) {
          console.log('Email verified successfully on client side for:', data.user.email);
          setStatus('success');
          toast.success('Email verified successfully!');

          // Start countdown timer
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer);
                // Redirect to trial setup
                router.push('/trial-setup');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          return () => clearInterval(timer);
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Unexpected verification error:', error);
        setStatus('error');
        toast.error('Something went wrong during verification');
      }
    };

    verifyAndRedirect();
  }, [searchParams, router]);

  const handleManualRedirect = () => {
    router.push('/trial-setup');
  };

  if (status === 'verifying') {
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
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <h2 className="text-lg font-semibold">Verifying your email...</h2>
              <p className="text-sm text-gray-600 text-center">
                Please wait while we confirm your email address.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
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
            <div className="flex flex-col items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                <span className="text-red-600 text-xl">✕</span>
              </div>
              <h2 className="text-lg font-semibold">Verification Failed</h2>
              <p className="text-sm text-gray-600 text-center">
                There was a problem verifying your email. The link may be expired or invalid.
              </p>
              <Button onClick={() => router.push('/sign-up')} className="w-full">
                Return to Sign Up
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
          <CardTitle className="text-center flex items-center justify-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Email Verified!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Great! Your email has been verified successfully. You're now ready to start your 7-day free trial.
          </p>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-800">
              Redirecting to trial setup in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
          
          <Button onClick={handleManualRedirect} className="w-full">
            Continue to Trial Setup
          </Button>
        </CardContent>
      </Card>
    </div>
  );
} 