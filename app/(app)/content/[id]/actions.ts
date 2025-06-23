'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define a schema for the updatable fields
const updatableFields = z.enum(['transcript', 'research', 'video_script']);
const videoFields = z.enum(['video_long_url', 'video_short_url']);

export async function updateContentField({
  contentId,
  fieldName,
  newValue,
}: {
  contentId: string;
  fieldName: z.infer<typeof updatableFields>;
  newValue: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to edit content.' };
  }

  // Validate the field name to prevent arbitrary column updates
  const parsedFieldName = updatableFields.safeParse(fieldName);
  if (!parsedFieldName.success) {
    return { success: false, error: 'Invalid field name.' };
  }

  // RLS will handle the authorization check, but we can double-check here
  // to provide a clearer error message if needed. This step is optional
  // if your RLS is robust.

  const { error } = await supabase
    .from('content')
    .update({ [parsedFieldName.data]: newValue })
    .eq('id', contentId);

  if (error) {
    console.error('Error updating content:', error);
    return {
      success: false,
      error: 'Failed to save changes. Please try again.',
    };
  }

  revalidatePath(`/content/${contentId}`);
  return { success: true, error: null };
}

export async function updateVideoUrl({
  contentId,
  videoType,
  videoUrl,
}: {
  contentId: string;
  videoType: 'long' | 'short';
  videoUrl: string | null;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to update videos.' };
  }

  const fieldName = videoType === 'long' ? 'video_long_url' : 'video_short_url';
  
  // Validate the field name
  const parsedFieldName = videoFields.safeParse(fieldName);
  if (!parsedFieldName.success) {
    return { success: false, error: 'Invalid video field name.' };
  }

  const { error } = await supabase
    .from('content')
    .update({ [parsedFieldName.data]: videoUrl })
    .eq('id', contentId);

  if (error) {
    console.error('Error updating video URL:', error);
    return {
      success: false,
      error: 'Failed to update video. Please try again.',
    };
  }

  revalidatePath(`/content/${contentId}`);
  return { success: true, error: null };
}

export async function generateContent(payload: {
  // Content fields
  contentId: string;
  content_title: string | null;
  transcript: string | null;
  research: string | null;
  video_script: string | null;
  keyword: string | null;
  // Business fields
  business_name: string;
  website_url: string | null;
  social_media_profiles: unknown | null;
  social_media_integrations: unknown | null;
  writing_style_guide: string | null;
  cta_youtube: string | null;
  cta_email: string | null;
  first_name: string | null;
  last_name: string | null;
  cta_social_long: string | null;
  cta_social_short: string | null;
  booking_link: string | null;
  email_name_token: string | null;
  email_sign_off: string | null;
  // New color fields
  color_primary: string | null;
  color_secondary: string | null;
  color_background: string | null;
  color_highlight: string | null;
}) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;

  // Debug: Log the webhook URL being used
  console.log('Using webhook URL:', webhookUrl);

  if (!webhookUrl) {
    console.error('N8N_WEBHOOK_URL_CONTENT_CREATION is not set.');
    return {
      success: false,
      error: 'Webhook URL is not configured.',
    };
  }

  try {
    // Helper function to safely escape and clean text for JSON
    const sanitizeText = (text: string | null): string => {
      if (!text) return '';
      return text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')   // Convert remaining \r to \n
        .trim(); // Remove leading/trailing whitespace
    };

    // Clean the payload: handle null values, JSON fields, and markdown properly
    const cleanedPayload = {
      ...payload,
      // Convert null to empty string and sanitize markdown content
      content_title: sanitizeText(payload.content_title),
      transcript: sanitizeText(payload.transcript),
      research: sanitizeText(payload.research),
      video_script: sanitizeText(payload.video_script),
      keyword: sanitizeText(payload.keyword),
      website_url: sanitizeText(payload.website_url),
      writing_style_guide: sanitizeText(payload.writing_style_guide),
      cta_youtube: sanitizeText(payload.cta_youtube),
      cta_email: sanitizeText(payload.cta_email),
      first_name: sanitizeText(payload.first_name),
      last_name: sanitizeText(payload.last_name),
      cta_social_long: sanitizeText(payload.cta_social_long),
      cta_social_short: sanitizeText(payload.cta_social_short),
      booking_link: sanitizeText(payload.booking_link),
      email_name_token: sanitizeText(payload.email_name_token),
      email_sign_off: sanitizeText(payload.email_sign_off),
      // Add new color fields to cleaned payload
      color_primary: sanitizeText(payload.color_primary),
      color_secondary: sanitizeText(payload.color_secondary),
      color_background: sanitizeText(payload.color_background),
      color_highlight: sanitizeText(payload.color_highlight),
      // Handle JSON fields - convert null to empty object
      social_media_profiles: payload.social_media_profiles || {},
      social_media_integrations: payload.social_media_integrations || {},
    };

    // Debug: Log the cleaned payload
    console.log('Sending cleaned payload:', JSON.stringify(cleanedPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cleanedPayload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Webhook call failed with status ${response.status}:`,
        errorBody
      );
      return {
        success: false,
        error: `Webhook call failed: ${response.statusText}`,
      };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Error calling webhook:', error);
    if (error instanceof Error) {
      return { success: false, error: `An error occurred: ${error.message}` };
    }
    return { success: false, error: 'An unknown error occurred.' };
  }
}

export async function updateContentAsset(
  assetId: string,
  updates: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('content_assets')
    .update(updates)
    .eq('id', assetId)
    .select('content_id')
    .single();

  if (error) {
    console.error('Error updating content asset:', error);
    return { success: false, error: error.message };
  }

  if (data?.content_id) {
    revalidatePath(`/content/${data.content_id}`);
  }

  return { success: true };
}

export async function scheduleContentAssets({
  contentId,
  startDate,
  businessTimezone,
}: {
  contentId: string;
  startDate: string; // ISO string of the start date
  businessTimezone: string;
}) {
  const supabase = await createClient();

  // First, get all unscheduled assets for this content
  const { data: assets, error: fetchError } = await supabase
    .from('content_assets')
    .select('*')
    .eq('content_id', contentId)
    .is('asset_scheduled_at', null)
    .order('created_at');

  if (fetchError) {
    console.error('Error fetching content assets:', fetchError);
    return { success: false, error: 'Failed to fetch content assets.' };
  }

  if (!assets || assets.length === 0) {
    return { success: false, error: 'No unscheduled assets found.' };
  }

  // Define the 5-day scheduling sequence
  const schedulingSequence = [
    { day: 0, types: ['youtube_video', 'blog_post', 'social_long_video'] },
    { day: 1, types: ['social_quote_card'] },
    { day: 2, types: ['email', 'social_blog_post'] },
    { day: 3, types: ['social_rant_post'] },
    { day: 4, types: ['social_short_video'] },
  ];

  // Create a map of asset types to assets
  const assetMap = new Map<string, typeof assets[0]>();
  assets.forEach(asset => {
    if (asset.content_type) {
      assetMap.set(asset.content_type, asset);
    }
  });

  // Generate schedule updates
  const updates: { id: string; asset_scheduled_at: string }[] = [];
  const startDateTime = new Date(startDate);

  for (const { day, types } of schedulingSequence) {
    for (const type of types) {
      const asset = assetMap.get(type);
      if (asset) {
        // Create the scheduled date at 10:00 AM
        const scheduledDate = new Date(startDateTime);
        scheduledDate.setDate(startDateTime.getDate() + day);
        scheduledDate.setHours(10, 0, 0, 0);
        
        const utcScheduledAt = scheduledDate.toISOString();

        updates.push({
          id: asset.id,
          asset_scheduled_at: utcScheduledAt,
        });
      }
    }
  }

  // Perform bulk update using individual UPDATE queries instead of upsert
  if (updates.length > 0) {
    try {
      // Update each asset individually to avoid RLS issues with upsert
      let successCount = 0;
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('content_assets')
          .update({ asset_scheduled_at: update.asset_scheduled_at })
          .eq('id', update.id);

        if (updateError) {
          console.error('Database update error for asset:', update.id, updateError);
          return { success: false, error: `Database error: ${updateError.message}` };
        }
        successCount++;
      }

      revalidatePath(`/content/${contentId}`);
      return { success: true, scheduled: successCount };
    } catch (error) {
      console.error('Unexpected error during database update:', error);
      return { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  return { success: false, error: 'No assets to schedule.' };
}

export async function updateAssetSchedule({
  assetId,
  newDateTime,
}: {
  assetId: string;
  newDateTime: string; // ISO string in UTC
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('content_assets')
    .update({ asset_scheduled_at: newDateTime })
    .eq('id', assetId)
    .select('content_id')
    .single();

  if (error) {
    console.error('Error updating asset schedule:', error);
    return { success: false, error: error.message };
  }

  if (data?.content_id) {
    revalidatePath(`/content/${data.content_id}`);
  }

  return { success: true };
}

export async function getBusinessAssets({
  businessId,
  startDate,
  endDate,
  excludeContentId,
}: {
  businessId: string;
  startDate: string;
  endDate: string;
  excludeContentId?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from('content_assets')
    .select(`
      *,
      content!inner(
        id,
        content_title,
        business_id
      )
    `)
    .eq('content.business_id', businessId)
    .not('asset_scheduled_at', 'is', null)
    .gte('asset_scheduled_at', startDate)
    .lte('asset_scheduled_at', endDate);

  if (excludeContentId) {
    query = query.neq('content.id', excludeContentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching business assets:', error);
    return { success: false, error: 'Failed to fetch scheduled assets.' };
  }

  return { success: true, data: data || [] };
}

export async function resetContentAssetSchedules({
  contentId,
}: {
  contentId: string;
}) {
  const supabase = await createClient();

  // Reset all scheduled dates for this content's assets
  const { error } = await supabase
    .from('content_assets')
    .update({ asset_scheduled_at: null })
    .eq('content_id', contentId)
    .not('asset_scheduled_at', 'is', null);

  if (error) {
    console.error('Error resetting content asset schedules:', error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/content/${contentId}`);
  return { success: true };
} 