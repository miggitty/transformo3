'use server';

import { createClient } from '@/utils/supabase/server';
import { authRateLimiter } from '@/lib/rate-limit';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signIn(email: string, password: string) {
  // Create a mock NextRequest for rate limiting
  const headersList = await headers();
  const mockRequest = {
    headers: headersList
  } as unknown as NextRequest;
  
  // Check rate limit
  const rateLimitResult = authRateLimiter.signIn(mockRequest);
  
  if (!rateLimitResult.allowed) {
    return {
      error: `Too many sign-in attempts. Please try again in ${rateLimitResult.retryAfter} seconds.`
    };
  }
  
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    return { error: error.message };
  }
  
  // Successful sign-in
  redirect('/content');
}