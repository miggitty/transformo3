'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { Tables } from '@/types/supabase';
import { triggerN8nWorkflow } from '@/lib/n8n';

// Action 1: Create an initial content record
export async function createContentRecord() {
  const cookieStore = cookies();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to create content.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return { error: 'Business profile not found.' };
  }

  const { data, error } = await supabase
    .from('content')
    .insert({
      business_id: profile.business_id,
      status: 'creating',
      content_title: `Audio Recording - ${new Date().toLocaleString()}`,
    })
    .select('id, business_id')
    .single();

  if (error) {
    console.error('Error creating content record:', error);
    return { error: 'Could not create content record.' };
  }

  return { data };
}

// Action 2: Finalize the content record with the audio URL
export async function finalizeContentRecord(
  contentId: string,
  audioUrl: string,
) {
  const cookieStore = cookies();
  const supabase = await createClient();

  const { data: updatedContent, error } = await supabase
    .from('content')
    .update({
      audio_url: audioUrl,
      status: 'processing',
    })
    .eq('id', contentId)
    .select('id, business_id, audio_url')
    .single();

  if (error || !updatedContent) {
    console.error('Error finalizing content record:', error);
    return { error: 'Could not update content record with audio URL.' };
  }

  // Trigger the n8n workflow (fire-and-forget)
  console.log('Attempting to trigger n8n workflow...');
  try {
    await triggerN8nWorkflow({
      audioUrl: updatedContent.audio_url!,
      contentId: updatedContent.id,
      businessId: updatedContent.business_id!,
    });
    console.log('Successfully triggered n8n workflow.');
  } catch (n8nError) {
    console.error('Failed to trigger n8n workflow:', n8nError);
    // Optional: Update status to 'failed' here
    // For now, we just log the error and continue.
  }

  revalidatePath('/dashboard/content');

  return { data: updatedContent };
} 