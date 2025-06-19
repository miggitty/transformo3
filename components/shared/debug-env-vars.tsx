'use client';

import { useEffect } from 'react';

export function DebugEnvVars() {
  useEffect(() => {
    console.log('--- Client-Side Environment Variable Debug ---');
    console.log('Client-side NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('Client-side NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    console.log('-------------------------------------------');
  }, []);

  return null; // This component doesn't render anything
} 