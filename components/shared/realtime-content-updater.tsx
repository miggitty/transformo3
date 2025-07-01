'use client';

import { useEffect, useRef, useCallback } from 'react';
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
  const currentContentRef = useRef<Tables<'content'>[]>(serverContent);
  const onUpdateRef = useRef(onUpdate);

  // Update refs when props change
  useEffect(() => {
    currentContentRef.current = serverContent;
  }, [serverContent]);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Stable callback functions that don't change
  const handleUpdate = useCallback((payload: any) => {
    console.log('🔄 Realtime UPDATE received for:', payload.new.content_title);
    
    const newContent = currentContentRef.current.map((item: Tables<'content'>) =>
      item.id === payload.new.id ? { ...item, ...payload.new } : item
    );
    
    currentContentRef.current = newContent;
    onUpdateRef.current(newContent);
  }, []); // No dependencies!

  const handleInsert = useCallback((payload: any) => {
    console.log('➕ Realtime INSERT received for:', payload.new.content_title);
    
    // Check if content already exists to avoid duplicates
    if (currentContentRef.current.find((item: Tables<'content'>) => item.id === payload.new.id)) {
      return;
    }
    
    const newContent = [payload.new as Tables<'content'>, ...currentContentRef.current];
    currentContentRef.current = newContent;
    onUpdateRef.current(newContent);
  }, []); // No dependencies!

  const handleDelete = useCallback((payload: any) => {
    console.log('🗑️ Realtime DELETE received for:', payload.old.content_title);
    
    const newContent = currentContentRef.current.filter((item: Tables<'content'>) => item.id !== payload.old.id);
    currentContentRef.current = newContent;
    onUpdateRef.current(newContent);
  }, []); // No dependencies!

  useEffect(() => {
    if (!businessId) return;

    console.log(`🔌 Setting up realtime subscription for business: ${businessId}`);

    const channel = supabase
      .channel(`content-changes:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'content',
          filter: `business_id=eq.${businessId}`,
        },
        handleUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'content',
          filter: `business_id=eq.${businessId}`,
        },
        handleInsert
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content',
          filter: `business_id=eq.${businessId}`,
        },
        handleDelete
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscription active`);
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription error:', err);
        }
        if (status === 'CLOSED') {
          console.log(`🔌 Realtime subscription closed`);
        }
      });

    // Cleanup: remove subscription when component unmounts or businessId changes
    return () => {
      console.log(`🔌 Cleaning up realtime subscription for business: ${businessId}`);
      supabase.removeChannel(channel);
    };
  }, [businessId, supabase]); // Only businessId and supabase since callbacks are now stable

  // This component renders nothing
  return null;
} 