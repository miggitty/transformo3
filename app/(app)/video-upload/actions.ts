'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Action 1: Create an initial content record with video_upload project type
export async function createVideoUploadProject() {
  console.log('Action: createVideoUploadProject started');
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

    if (profileError || !profile?.business_id) {
      console.error('Action Error: Business ID not found for user.', profileError);
      return { error: 'Business profile not found' };
    }
    console.log(`Action: Business ID retrieved: ${profile.business_id}`);

    const { data, error } = await supabase
      .from('content')
      .insert({
        business_id: profile.business_id,
        project_type: 'video_upload',
        status: 'creating',
      })
      .select('id, business_id')
      .single();

    if (error) {
      console.error('Action Error: Failed to create content record.', error);
      return { error: 'Failed to create content record' };
    }

    console.log(`Action: Content record created successfully. { contentId: '${data.id}', businessId: '${data.business_id}' }`);
    return { data };
  } catch (error) {
    console.error('Action Error: Unexpected error in createVideoUploadProject.', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Action 2: Finalize video upload and trigger N8N video processing workflow
// This now works EXACTLY like audio processing - unified workflow
export async function finalizeVideoUploadRecord(contentId: string, videoUrl: string) {
  console.log('Action: finalizeVideoUploadRecord started', { contentId, videoUrl });
  const supabase = await createSupabaseServerClient();

  console.log('=== Video URL Debug Info ===');
  console.log('Input videoUrl:', videoUrl);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('NEXT_PUBLIC_SUPABASE_EXTERNAL_URL:', process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL);

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Action Error: User not found.', userError);
      return { error: 'User not found' };
    }

    // Update the content record with video URL and set status to processing
    const { data: updatedContent, error: updateError } = await supabase
      .from('content')
      .update({
        video_long_url: videoUrl,
        status: 'processing',
      })
      .eq('id', contentId)
      .select('id, business_id')
      .single();

    if (updateError || !updatedContent) {
      console.error('Action Error: Failed to update content record.', updateError);
      return { error: 'Failed to update content record' };
    }

    console.log(`Action: Content record updated successfully. { contentId: '${updatedContent.id}' }`);

    // For N8N, we need to provide a publicly accessible URL (same logic as audio)
    let publicVideoUrl = videoUrl;
    
    // In local development, convert local Supabase URLs to external Supabase URLs for N8N access
    if (process.env.NODE_ENV === 'development' && videoUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
      // Extract the path from the local Supabase URL and construct external Supabase URL
      const urlPath = videoUrl.replace('http://127.0.0.1:54321', '');
      publicVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
      console.log('URL converted for development - urlPath:', urlPath);
      console.log('URL converted for development - publicVideoUrl:', publicVideoUrl);
    }
    // In production/staging, videoUrl is already a public Supabase URL that N8N can access directly

    console.log('Final publicVideoUrl being sent to N8N:', publicVideoUrl);

    // Trigger N8N video processing workflow (unified workflow like audio)
    const webhookUrl = process.env.N8N_WEBHOOK_URL_VIDEO_TRANSCRIPTION;
    
    console.log('=== N8N Environment Variables Debug ===');
    console.log('N8N_WEBHOOK_URL_VIDEO_TRANSCRIPTION:', webhookUrl);
    console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('N8N_CALLBACK_SECRET exists:', !!process.env.N8N_CALLBACK_SECRET);
    console.log('NODE_ENV:', process.env.NODE_ENV);

    if (!webhookUrl) {
      console.error('Action Error: N8N_WEBHOOK_URL_VIDEO_TRANSCRIPTION is not set.');
      return { error: 'Video transcription webhook URL is not configured' };
    }

    try {
      // Use EXACT same payload structure as audio processing
      const enrichedPayload = {
        video_url: publicVideoUrl,
        content_id: updatedContent.id,
        business_id: updatedContent.business_id!,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
        callbackSecret: process.env.N8N_CALLBACK_SECRET,
        environment: process.env.NODE_ENV
      };

      console.log('Triggering N8N video processing workflow...');
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
      revalidatePath('/content/drafts');

      return { success: true, data: { message: 'Video processing started successfully' } };
    } catch (error) {
      console.error('N8N integration error:', error);
      return { error: 'Failed to trigger N8N workflow' };
    }
  } catch (error) {
    console.error('Action Error: Unexpected error in finalizeVideoUploadRecord.', error);
    return { error: 'An unexpected error occurred during video processing setup' };
  }
} 