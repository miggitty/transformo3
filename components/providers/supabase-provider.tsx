'use client';

import { createContext, useContext, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { SupabaseClient } from '@supabase/supabase-js';
import { type Database } from '@/types/supabase';

type SupabaseContextType = {
  supabase: SupabaseClient<Database>;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(
  undefined
);

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabase] = useState(() => {
    try {
      return createClient();
    } catch (error) {
      console.warn('Failed to create Supabase client:', error);
      return null as any;
    }
  });

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export const useSupabaseBrowser = () => {
  const context = useContext(SupabaseContext);

  if (context === undefined) {
    throw new Error('useSupabaseBrowser must be used within a SupabaseProvider');
  }

  return context.supabase;
}; 