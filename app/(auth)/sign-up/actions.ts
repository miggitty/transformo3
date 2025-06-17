'use server';

import { createClient as createServerClient } from '@/utils/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function signup(prevState: unknown, formData: FormData) {
  // Use the server client for the initial user sign-up
  const supabaseUserClient = await createServerClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  const businessName = formData.get('businessName') as string;

  // 1. Sign up the user. This client handles cookies and user session.
  const { data: authData, error: authError } =
    await supabaseUserClient.auth.signUp({
      email,
      password,
    });

  if (authError || !authData.user) {
    return {
      message: authError?.message || 'Could not authenticate user.',
    };
  }

  // 2. From this point, use an admin client to bypass RLS and perform sensitive operations.
  // This is secure because this code only runs on the server and uses a secret key.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // 3. Create the business
  const { data: businessData, error: businessError } = await supabaseAdmin
    .from('businesses')
    .insert({
      business_name: businessName || `${firstName}'s Business`,
    })
    .select('id')
    .single();

  if (businessError || !businessData) {
    // If this fails, delete the user we just created.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return {
      message: businessError?.message || 'Could not create business.',
    };
  }

  // 4. Create the user's profile
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: authData.user.id,
    business_id: businessData.id,
    first_name: firstName,
    last_name: lastName,
    is_admin: false,
  });

  if (profileError) {
    // If this fails, delete the user AND the business we just created.
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    await supabaseAdmin.from('businesses').delete().match({ id: businessData.id });
    return {
      message: profileError.message,
    };
  }

  revalidatePath('/', 'layout');
  redirect('/content');
} 