'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { triggerN8nWorkflow } from '@/lib/n8n';

// Action 1: Create an initial content record
export async function createContentRecord() {
  console.log('Action: createContentRecord started');
  const supabase = await createSupabaseServerClient();
  console.log('Action: Supabase client created.');

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Action Error: User not found.', userError);
      return { error: 'User not found' };
    }
    console.log(`Action: User retrieved successfully. { userId: '${user.id}' }`);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.business_id) {
      console.error(
        'Action Error: Business ID not found for user.',
        profileError,
      );
      return { error: 'Business ID not found for user' };
    }
    console.log(
      `Action: Profile retrieved successfully. { businessId: '${profile.business_id}' }`,
    );

    const { data: contentData, error: contentError } = await supabase
      .from('content')
      .insert({ 
        business_id: profile.business_id,
        content_title: `New Recording - ${new Date().toISOString()}`,
        status: 'creating' 
      })
      .select('id, business_id')
      .single();

    if (contentError) {
      console.error('Action Error: Failed to insert content.', contentError);
      return { error: 'Failed to insert content record' };
    }
    console.log('Action: Content record inserted successfully.', {
      data: contentData,
    });
    return { data: contentData };
  } catch (e: any) {
    console.error('Action Exception:', e.message);
    return { error: e.message };
  }
}

// Action 2: Finalize the content record with the audio URL
export async function finalizeContentRecord(
  contentId: string,
  audioUrl: string,
) {
  const supabase = await createSupabaseServerClient();

  const { data: updatedContent, error } = await supabase
    .from('content')
    .update({
      audio_url: audioUrl,
      status: 'processing',
    })
    .eq('id', contentId)
    .select('id, business_id')
    .single();

  if (error || !updatedContent) {
    console.error('Error finalizing content record:', error);
    return { error: 'Could not update content record' };
  }

  // For n8n, we need to provide a publicly accessible URL
  let publicAudioUrl = audioUrl;
  
  // In local development, convert local Supabase URLs to ngrok URLs for n8n access
  if (process.env.NODE_ENV === 'development' && audioUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_APP_URL) {
    // Extract the path from the local Supabase URL and construct ngrok URL
    const urlPath = audioUrl.replace('http://127.0.0.1:54321', '');
    publicAudioUrl = `${process.env.NEXT_PUBLIC_APP_URL}${urlPath}`;
  }
  // In production/staging, audioUrl is already a public Supabase URL that n8n can access directly

  await triggerN8nWorkflow({
    webhookUrl: process.env.N8N_WEBHOOK_URL!,
    audioUrl: publicAudioUrl,
    contentId: updatedContent.id,
    businessId: updatedContent.business_id!,
  });

  revalidatePath('/content');
  revalidatePath(`/content/${contentId}`);

  return { data: { message: 'Content finalized successfully' } };
}