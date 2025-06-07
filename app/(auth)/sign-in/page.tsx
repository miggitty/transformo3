'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      router.push('/content'); // Redirect to content page on successful sign-in
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
          className="mb-6 rounded-md border bg-inherit px-4 py-2"
          type="password"
          name="password"
          onChange={(e) => setPassword(e.target.value)}
          value={password}
          placeholder="••••••••"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>

        <p className="px-4 py-4 text-center text-sm">
          Don't have an account?{' '}
          <Link href="/sign-up" className="font-bold underline">
            Sign Up
          </Link>
        </p>
      </form>
    </div>
  );
} 