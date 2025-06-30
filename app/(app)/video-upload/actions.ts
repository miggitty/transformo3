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
        content_generation_status: 'pending',
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

// Action 2: Finalize video upload and trigger N8N video transcription workflow
export async function finalizeVideoUploadRecord(contentId: string, videoUrl: string) {
  console.log('Action: finalizeVideoUploadRecord started', { contentId, videoUrl });
  const supabase = await createSupabaseServerClient();

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
        content_generation_status: 'pending',
      })
      .eq('id', contentId)
      .select('id, business_id, video_long_url')
      .single();

    if (updateError || !updatedContent) {
      console.error('Action Error: Failed to update content record.', updateError);
      return { error: 'Failed to update content record' };
    }

    console.log(`Action: Content record updated successfully. { contentId: '${updatedContent.id}' }`);

    // Trigger N8N video transcription webhook
    const webhookUrl = process.env.N8N_WEBHOOK_URL_VIDEO_TRANSCRIPTION;
    console.log('Action: Webhook URL:', webhookUrl);

    if (!webhookUrl) {
      console.error('Action Error: N8N_WEBHOOK_URL_VIDEO_TRANSCRIPTION is not set.');
      return { error: 'Video transcription webhook URL is not configured' };
    }

    const webhookPayload = {
      content_id: contentId,
      business_id: updatedContent.business_id,
      video_url: videoUrl,
      project_type: 'video_upload',
      callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callback_secret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV,
    };

    console.log('Action: Sending webhook payload:', JSON.stringify(webhookPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Action Error: Webhook request failed. Status: ${response.status}, Response: ${errorText}`);
      return { error: `Failed to trigger video transcription: ${response.status}` };
    }

    const responseData = await response.json();
    console.log('Action: Webhook response:', responseData);

    console.log(`Action: Video transcription workflow triggered successfully for content ${contentId}`);
    revalidatePath('/content');
    revalidatePath('/content/drafts');
    
    return { success: true, data: updatedContent };
  } catch (error) {
    console.error('Action Error: Unexpected error in finalizeVideoUploadRecord.', error);
    return { error: 'An unexpected error occurred during video transcription setup' };
  }
} 