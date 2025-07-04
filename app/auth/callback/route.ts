import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/trial-setup';

  if (code) {
    const supabase = await createClient();
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error && data.user) {
        // Email verification successful
        console.log('Email verified via callback for user:', data.user.email);
        
        // Redirect to success page
        return NextResponse.redirect(`${origin}${next}`);
      } else {
        console.error('Email verification callback error:', error);
        
        // Redirect back to verification page with error
        return NextResponse.redirect(
          `${origin}/verify-email?error=invalid_link&message=${encodeURIComponent(
            error?.message || 'Invalid verification link'
          )}`
        );
      }
    } catch (error) {
      console.error('Unexpected error in auth callback:', error);
      
      return NextResponse.redirect(
        `${origin}/verify-email?error=callback_error&message=${encodeURIComponent(
          'Verification failed. Please try again.'
        )}`
      );
    }
  }

  // No code provided, redirect to sign up
  return NextResponse.redirect(`${origin}/sign-up`);
} 