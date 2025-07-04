import { createBrowserClient } from '@supabase/ssr';
import { type Database } from '@/types/supabase';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  // Return existing client if already created
  if (client) {
    return client;
  }

  // --- START VERCEL DEBUG LOG ---
  console.log('--- CLIENT-SIDE ENVIRONMENT CHECK ---');
  console.log(
    'NEXT_PUBLIC_SUPABASE_URL:',
    process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Exists' : 'MISSING OR EMPTY'
  );
  console.log(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY:',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Exists' : 'MISSING OR EMPTY'
  );
  console.log('-----------------------------------');
  // --- END VERCEL DEBUG LOG ---

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    
    // Return null instead of throwing to allow components to handle gracefully
    return null;
  }

  try {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          flowType: 'pkce',
          autoRefreshToken: true,
          persistSession: true,
        },
      }
    );
    
    console.log('✅ Supabase client created successfully');
    return client;
  } catch (error) {
    console.error('❌ Failed to create Supabase client:', error);
    return null;
  }
}

// Safe client for components that need to throw if env vars are missing
export function createClientSafe() {
  const supabaseClient = createClient();
  if (!supabaseClient) {
    throw new Error('Supabase client could not be created. Check your environment variables.');
  }
  return supabaseClient;
}