'use client';

import { useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signIn } from './actions';

function SignInContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  
  // Get message from URL parameters
  const message = searchParams.get('message');

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      // Use server action with rate limiting
      const result = await signIn(email, password);
      
      if (result?.error) {
        toast.error(result.error);
        setLoading(false);
      }
      // If no error, the server action will redirect
    } catch {
      toast.error('Authentication service unavailable. Please try again later.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8 sm:max-w-md">
      <Image
        src="/transformo-logo.webp"
        alt="Transformo Logo"
        width={200}
        height={50}
        className="h-auto w-auto"
      />
      
      {message && (
        <Alert className="w-full">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      
      <form
        onSubmit={handleSignIn}
        className="animate-in text-foreground flex w-full flex-col justify-center gap-2"
      >
        <Label className="text-md" htmlFor="email">
          Email
        </Label>
        <Input
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          value={email}
          placeholder="you@example.com"
        />
        <Label className="text-md" htmlFor="password">
          Password
        </Label>
        <Input
          className="mb-3 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="••••••••"
        />
        <div className="text-right mb-4">
          <Link 
            href="/forgot-password" 
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>

        <p className="px-4 py-4 text-center text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="font-bold underline">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
        <Image
          src="/transformo-logo.webp"
          alt="Transformo Logo"
          width={200}
          height={50}
          className="h-auto w-auto"
        />
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
} 