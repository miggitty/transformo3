'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '../providers/supabase-provider';

export function RealtimeContentUpdater({
  businessId,
}: {
  businessId: string;
}) {
  const supabase = useSupabaseBrowser();
  const router = useRouter();

  useEffect(() => {
    // Simple realtime subscription following Supabase best practices
    const channel = supabase
      .channel('content-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'content',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          console.log('🔄 Content change detected:', payload);
          // Simply refresh the page data - Next.js will handle the rest
          router.refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'content_assets',
        },
        (payload) => {
          console.log('🔄 Content assets change detected:', payload);
          // Refresh when assets change too (for status updates)
          router.refresh();
        }
      )
      .subscribe();

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, supabase, router]);

  // No UI needed - this is a background service
  return null;
} 