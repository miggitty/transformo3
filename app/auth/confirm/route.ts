import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/account/update-password';
  
  // Use app URL from environment instead of request origin for ngrok compatibility
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Handle both old-style (code) and new-style (token_hash) verification links
  if (code && !token_hash && !type) {
    // This is likely an old-style email verification link with just code
    // Use exchangeCodeForSession for code-based verification
    const supabase = await createClient();
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (!error && data.user) {
        console.log('Email verification successful via code for user:', data.user.email);
        // For code-based verification, assume it's signup verification
        return NextResponse.redirect(`${appUrl}/auth/verify-success?verified=true`);
      } else {
        console.error('Code verification error:', error);
        return NextResponse.redirect(
          `${appUrl}/verify-email?error=invalid_link&message=${encodeURIComponent(
            error?.message || 'Invalid verification link'
          )}`
        );
      }
    } catch (error) {
      console.error('Unexpected error in code verification:', error);
      return NextResponse.redirect(
        `${appUrl}/verify-email?error=verification_error&message=${encodeURIComponent(
          'Verification failed. Please try again.'
        )}`
      );
    }
  }

  // For email verification links, we need to handle them differently
  // than password reset links to ensure proper session establishment
  if (token_hash && type) {
    const supabase = await createClient();
    
    try {
      // Use verifyOtp for token-based verification
      const { data, error } = await supabase.auth.verifyOtp({
        type: type as 'signup' | 'email' | 'recovery',
        token_hash,
      });
      
      if (!error && data.user) {
        console.log(`${type} verification successful for user:`, data.user.email);
        
        // For password recovery, redirect to update password page
        if (type === 'recovery') {
          return NextResponse.redirect(`${appUrl}/account/update-password`);
        }
        
        // For email verification (signup), redirect to client-side verification handler
        if (type === 'signup' || type === 'email') {
          return NextResponse.redirect(`${appUrl}/auth/verify-success?token_hash=${token_hash}&type=${type}`);
        }
        
        // Default redirect
        return NextResponse.redirect(`${appUrl}${next}`);
      } else {
        console.error(`${type} verification error:`, error);
        
        // Handle different error types
        if (type === 'recovery') {
          return NextResponse.redirect(
            `${appUrl}/forgot-password?error=invalid_link&message=${encodeURIComponent(
              error?.message || 'Invalid or expired password reset link'
            )}`
          );
        } else {
          return NextResponse.redirect(
            `${appUrl}/verify-email?error=invalid_link&message=${encodeURIComponent(
              error?.message || 'Invalid verification link'
            )}`
          );
        }
      }
    } catch (error) {
      console.error(`Unexpected error in ${type} confirmation:`, error);
      
      if (type === 'recovery') {
        return NextResponse.redirect(
          `${appUrl}/forgot-password?error=confirmation_error&message=${encodeURIComponent(
            'Password reset failed. Please try again.'
          )}`
        );
      } else {
        return NextResponse.redirect(
          `${appUrl}/verify-email?error=confirmation_error&message=${encodeURIComponent(
            'Verification failed. Please try again.'
          )}`
        );
      }
    }
  }

  // No token_hash or type provided
  console.error('Missing token_hash or type in confirmation URL');
  return NextResponse.redirect(`${appUrl}/sign-in`);
} 