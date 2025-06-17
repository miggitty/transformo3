import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';

export function createClient(): SupabaseClient<Database> | null {
  // During build time, environment variables might not be available
  // Return a null client that can be handled gracefully
  if (typeof window === 'undefined') {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase environment variables not available during build time');
      return null;
    }
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables missing:', {
      url: !!supabaseUrl,
      key: !!supabaseAnonKey
    });
    
    throw new Error('@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!\n\nCheck your Supabase project\'s API settings to find these values\n\nhttps://supabase.com/dashboard/project/_/settings/api');
  }
  
  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  );
}

// Safe client for client-side components that throws if env vars are missing
export function createClientSafe(): SupabaseClient<Database> {
  const client = createClient();
  if (!client) {
    throw new Error('@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!\n\nCheck your Supabase project\'s API settings to find these values\n\nhttps://supabase.com/dashboard/project/_/settings/api');
  }
  return client;
}