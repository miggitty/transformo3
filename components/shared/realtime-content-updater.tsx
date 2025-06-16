'use client';

import { useEffect, useState } from 'react';
import { useSupabaseBrowser } from '../providers/supabase-provider';
import { Tables } from '@/types/supabase';

export function RealtimeContentUpdater({
  businessId,
  serverContent,
  onUpdate,
}: {
  businessId: string;
  serverContent: Tables<'content'>[];
  onUpdate: (newContent: Tables<'content'>[]) => void;
}) {
  const supabase = useSupabaseBrowser();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This guard ensures the subscription only runs on the client,
    // after the component has mounted.
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // If the component isn't mounted, or if we don't have a businessId, do nothing.
    if (!isMounted || !businessId) return;

    const channel = supabase
      .channel(`realtime-content-updater:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          // When an update is received, we call the onUpdate function
          // passed down from the parent to update its state.
          const newContent = serverContent.map((item) =>
            item.id === payload.new.id ? { ...item, ...payload.new } : item
          );
          onUpdate(newContent);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime updater subscribed for: ${businessId}`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error(
            '❌ Realtime updater error. Check RLS policies.',
            err
          );
        }
      });

    // Cleanup function: remove the channel subscription when the component unmounts.
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMounted, businessId, supabase, onUpdate, serverContent]);

  // This component does not render anything itself.
  return null;
} 