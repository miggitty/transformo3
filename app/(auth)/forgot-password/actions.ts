'use server';

import { createClient } from '@/utils/supabase/server';
import { isValidEmail } from '@/lib/auth-utils';
import type { ForgotPasswordState } from '@/types/auth';

export async function requestPasswordReset(
  prevState: ForgotPasswordState, 
  formData: FormData
): Promise<ForgotPasswordState> {
  try {
    const email = formData.get('email')?.toString()?.trim();

    if (!email || !isValidEmail(email)) {
      return {
        message: 'Please enter a valid email address',
        errors: { email: ['Invalid email format'] },
      };
    }

    const supabase = await createClient();

    // Use Supabase's built-in password reset
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/account/update-password`,
    });

    if (error) {
      console.error('Password reset error:', error);
      
      // Handle specific Supabase errors
      if (error.message.includes('Email rate limit')) {
        return {
          message: 'Too many password reset attempts. Please try again later.',
        };
      }
      
      // For security, don't reveal specific errors to prevent email enumeration
      // Always show success message in UI regardless of whether email exists
    }

    // Always return success to prevent email enumeration attacks
    return {
      success: true,
      email: email,
      message: 'Password reset email sent successfully',
    };

  } catch (error) {
    console.error('Unexpected error in password reset:', error);
    return {
      message: 'An unexpected error occurred. Please try again.',
    };
  }
} 