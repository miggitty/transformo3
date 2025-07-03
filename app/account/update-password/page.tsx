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
      if (!supabase) {
        toast.error('Connection error. Please try again.');
        router.push('/forgot-password');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // User is authenticated, check if they came from a password reset
        setIsValidSession(true);
      } else {
        // No user session - this shouldn't happen if they came from /auth/confirm
        // But let's check for legacy URL parameters just in case
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
          } catch {
            toast.error('Invalid password reset link');
            router.push('/forgot-password');
          }
        } else {
          toast.error('Please use the password reset link from your email');
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
      if (!supabase) {
        toast.error('Connection error. Please try again.');
        return;
      }
      
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
    } catch {
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