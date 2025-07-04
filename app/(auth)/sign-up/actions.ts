'use server';

import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { validateEmail, validateName, validatePassword } from '@/lib/auth-utils';
import type { SignupState } from '@/types/auth';

export async function signup(prevState: SignupState, formData: FormData): Promise<SignupState> {
  try {
    // Extract and validate form data
    const email = formData.get('email')?.toString()?.trim() || '';
    const password = formData.get('password')?.toString() || '';
    const firstName = formData.get('firstName')?.toString()?.trim() || '';
    const lastName = formData.get('lastName')?.toString()?.trim() || '';
    const businessName = formData.get('businessName')?.toString()?.trim() || '';
    const passwordValidFromClient = formData.get('passwordValid') === 'true';

    // Validation errors object
    const errors: Record<string, string[]> = {};

    // Server-side validation (don't trust client)
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      errors.email = [emailValidation.error || 'Invalid email'];
    }

    const firstNameValidation = validateName(firstName);
    if (!firstNameValidation.isValid) {
      errors.firstName = [firstNameValidation.error || 'Invalid first name'];
    }

    const lastNameValidation = validateName(lastName);
    if (!lastNameValidation.isValid) {
      errors.lastName = [lastNameValidation.error || 'Invalid last name'];
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.errors;
    }

    // Check if client-side validation was bypassed
    if (!passwordValidFromClient && passwordValidation.isValid) {
      console.warn('Client-side validation bypassed for:', email);
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return {
        message: 'Please fix the errors below',
        errors,
      };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Attempt to create user - don't require email confirmation for trial flow
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
        data: {
          first_name: firstName,
          last_name: lastName,
        }
      }
    });

    if (authError) {
      console.error('Signup error:', authError);
      
      // Handle specific Supabase auth errors
      if (authError.message.includes('Password')) {
        return {
          message: 'Password does not meet security requirements',
          errors: { password: [authError.message] }
        };
      }
      
      if (authError.message.includes('email')) {
        return {
          message: 'Invalid email address',
          errors: { email: [authError.message] }
        };
      }

      if (authError.message.includes('already registered')) {
        return {
          message: 'An account with this email already exists. Try signing in instead.',
          errors: { email: ['Email already registered'] }
        };
      }

      return {
        message: authError.message || 'Could not create account. Please try again.',
      };
    }

    if (!authData.user) {
      return {
        message: 'Failed to create user account. Please try again.',
      };
    }

    // Create admin client for database operations
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Create business record
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from('businesses')
      .insert({
        business_name: businessName || `${firstName} ${lastName}'s Business`,
      })
      .select('id')
      .single();

    if (businessError) {
      console.error('Business creation error:', businessError);
      // Continue anyway - business can be created later
    }

    // Create profile record
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: authData.user.id,
      business_id: businessData?.id || null,
      first_name: firstName,
      last_name: lastName,
      is_admin: false,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Continue anyway - profile can be created later
    }

    // Return success state with verification info
    return {
      success: true,
      email: email,
      userId: authData.user.id,
      needsVerification: !authData.user.email_confirmed_at,
    };

  } catch (error) {
    console.error('Unexpected signup error:', error);
    return {
      message: 'An unexpected error occurred. Please try again.',
    };
  }
} 