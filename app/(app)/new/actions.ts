'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error occurred';
    console.error('Action Exception:', message);
    return { error: message };
  }
}

// Action 2: Finalize the content record with the audio URL
export async function finalizeContentRecord(
  contentId: string,
  audioUrl: string,
) {
  const supabase = await createSupabaseServerClient();

  console.log('=== Audio URL Debug Info ===');
  console.log('Input audioUrl:', audioUrl);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('NEXT_PUBLIC_SUPABASE_EXTERNAL_URL:', process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL);

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
  
  // In local development, convert local Supabase URLs to external Supabase URLs for n8n access
  if (process.env.NODE_ENV === 'development' && audioUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
    // Extract the path from the local Supabase URL and construct external Supabase URL
    const urlPath = audioUrl.replace('http://127.0.0.1:54321', '');
    publicAudioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
    console.log('URL converted for development - urlPath:', urlPath);
    console.log('URL converted for development - publicAudioUrl:', publicAudioUrl);
  }
  // In production/staging, audioUrl is already a public Supabase URL that n8n can access directly

  console.log('Final publicAudioUrl being sent to N8N:', publicAudioUrl);
  console.log('publicAudioUrl type:', typeof publicAudioUrl);
  console.log('publicAudioUrl length:', publicAudioUrl?.length);

  // Follow the content creation pattern with enriched payload
  const webhookUrl = process.env.N8N_WEBHOOK_URL_AUDIO_PROCESSING;
  
  console.log('=== N8N Environment Variables Debug ===');
  console.log('N8N_WEBHOOK_URL_AUDIO_PROCESSING:', webhookUrl);
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('N8N_CALLBACK_SECRET exists:', !!process.env.N8N_CALLBACK_SECRET);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  if (!webhookUrl) {
    console.error('N8N_WEBHOOK_URL_AUDIO_PROCESSING is not configured');
    return { error: 'Audio processing webhook not configured' };
  }

  try {
    // Add environment-specific callback information (following content creation pattern)
    const enrichedPayload = {
      audio_url: publicAudioUrl,
      content_id: updatedContent.id,
      business_id: updatedContent.business_id!,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV
    };

    console.log('Triggering N8N audio processing workflow...');
    console.log('N8N Payload being sent:', JSON.stringify(enrichedPayload, null, 2));
    console.log('Making fetch request to:', webhookUrl);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    console.log('N8N webhook response status:', response.status);
    console.log('N8N webhook response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook failed:', errorText);
      return { error: `N8N webhook failed: ${response.statusText}` };
    }

    const responseText = await response.text();
    console.log('N8N webhook response body:', responseText);

    revalidatePath('/content');
    revalidatePath(`/content/${contentId}`);

    return { data: { message: 'Content finalized successfully' } };
  } catch (error) {
    console.error('N8N integration error:', error);
    return { error: 'Failed to trigger N8N workflow' };
  }
}