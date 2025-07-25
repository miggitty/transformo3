'use server';

import { createClient } from '@/utils/supabase/server';
import { authRateLimiter } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { SignupState } from '@/types/auth';

// Form action for useFormState
export async function signUp(
  prevState: SignupState, 
  formData: FormData
): Promise<SignupState> {
  const email = formData.get('email')?.toString();
  const password = formData.get('password')?.toString();
  
  if (!email || !password) {
    return {
      message: 'Email and password are required',
      errors: { 
        ...((!email) && { email: ['Email is required'] }),
        ...((!password) && { password: ['Password is required'] })
      },
    };
  }
  
  return signUpWithEmailPassword(email, password);
}

// Helper function for direct email/password signup
export async function signUpWithEmailPassword(email: string, password: string): Promise<SignupState> {
  // Create a mock NextRequest for rate limiting
  const headersList = await headers();
  const mockRequest = {
    headers: headersList
  } as unknown as NextRequest;
  
  // Check rate limit
  const rateLimitResult = authRateLimiter.signUp(mockRequest);
  
  if (!rateLimitResult.allowed) {
    return {
      message: `Too many sign-up attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`
    };
  }
  
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  
  if (error) {
    return { 
      message: error.message,
      errors: { email: [error.message] }
    };
  }
  
  // Successful sign-up
  redirect('/verify-email');
}