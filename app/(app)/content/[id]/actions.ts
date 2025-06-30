'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define a schema for the updatable fields
const updatableFields = z.enum(['transcript', 'research', 'video_script', 'content_title']);
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
    // First, update the content status to 'generating'
    const supabase = await createClient();
    const { error: statusUpdateError } = await supabase
      .from('content')
      .update({ content_generation_status: 'generating' })
      .eq('id', payload.contentId);

    if (statusUpdateError) {
      console.error('Error updating content generation status:', statusUpdateError);
      return {
        success: false,
        error: 'Failed to update content status.',
      };
    }

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
      // Add callback information for N8N
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV,
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
      
      // Revert the status update if webhook fails
      await supabase
        .from('content')
        .update({ content_generation_status: null })
        .eq('id', payload.contentId);
        
      return {
        success: false,
        error: `Webhook call failed: ${response.statusText}`,
      };
    }

    console.log('Content generation webhook triggered successfully');
    revalidatePath(`/content/${payload.contentId}`);
    return { success: true, error: null };
  } catch (error) {
    console.error('Error calling webhook:', error);
    
    // Revert the status update if there's an error
    try {
      const supabase = await createClient();
      await supabase
        .from('content')
        .update({ content_generation_status: null })
        .eq('id', payload.contentId);
    } catch (revertError) {
      console.error('Error reverting status:', revertError);
    }
    
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

export async function toggleAssetApproval({
  assetId,
  approved,
}: {
  assetId: string;
  approved: boolean;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to update approval status.' };
  }

  const { data, error } = await supabase
    .from('content_assets')
    .update({ approved })
    .eq('id', assetId)
    .select('content_id')
    .single();

  if (error) {
    console.error('Error updating asset approval:', error);
    return {
      success: false,
      error: 'Failed to update approval status. Please try again.',
    };
  }

  // Revalidate the content detail page
  if (data?.content_id) {
    revalidatePath(`/content/${data.content_id}`);
  }

  return { success: true, error: null };
}

export async function bulkApproveAssets({
  assetIds,
  approved,
}: {
  assetIds: string[];
  approved: boolean;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to update approval status.' };
  }

  const { data, error } = await supabase
    .from('content_assets')
    .update({ approved })
    .in('id', assetIds)
    .select('content_id');

  if (error) {
    console.error('Error bulk updating asset approvals:', error);
    return {
      success: false,
      error: 'Failed to update approval statuses. Please try again.',
    };
  }

  // Revalidate content detail pages for all affected content
  const contentIds = [...new Set(data?.map(item => item.content_id).filter(Boolean))];
  contentIds.forEach(contentId => {
    revalidatePath(`/content/${contentId}`);
  });

  return { 
    success: true, 
    error: null,
    updatedCount: assetIds.length 
  };
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

// FEATURE: Batch Scheduling - Save multiple pending changes at once
export async function saveBatchScheduleChanges({
  changes,
  contentId,
}: {
  changes: Array<{ assetId: string; newDateTime: string }>;
  contentId: string;
}) {
  const supabase = await createClient();

  if (changes.length === 0) {
    return { success: false, error: 'No changes to save.' };
  }

  const results = [];
  let successCount = 0;
  let hasErrors = false;
  const errors: Array<{ assetId: string; error: string }> = [];

  // Process each change individually for granular error handling
  for (const change of changes) {
    try {
      const { data, error } = await supabase
        .from('content_assets')
        .update({ asset_scheduled_at: change.newDateTime })
        .eq('id', change.assetId)
        .select('content_id')
        .single();

      if (error) {
        console.error('Error updating asset schedule:', change.assetId, error);
        hasErrors = true;
        errors.push({ 
          assetId: change.assetId, 
          error: error.message 
        });
        results.push({ assetId: change.assetId, success: false, error: error.message });
      } else {
        successCount++;
        results.push({ assetId: change.assetId, success: true });
      }
    } catch (error) {
      console.error('Unexpected error updating asset:', change.assetId, error);
      hasErrors = true;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ 
        assetId: change.assetId, 
        error: errorMessage 
      });
      results.push({ assetId: change.assetId, success: false, error: errorMessage });
    }
  }

  // Revalidate the page regardless of errors (for successful updates)
  if (successCount > 0) {
    revalidatePath(`/content/${contentId}`);
  }

  if (hasErrors && successCount === 0) {
    // All updates failed
    return { 
      success: false, 
      error: `Failed to update all ${changes.length} assets.`,
      results,
      errors
    };
  } else if (hasErrors) {
    // Partial success
    return { 
      success: true, 
      scheduled: successCount,
      warning: `${successCount} of ${changes.length} assets updated successfully. ${errors.length} failed.`,
      results,
      errors
    };
  } else {
    // All successful
    return { 
      success: true, 
      scheduled: successCount,
      results
    };
  }
}

export async function deleteContent({
  contentId,
  businessId,
}: {
  contentId: string;
  businessId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to delete content.' };
  }

  try {
    // Step 1: Delete files from storage buckets
    console.log(`Deleting content ${contentId} for business ${businessId}`);
    
    // More comprehensive file patterns - check various naming conventions
    const filePatterns = [
      contentId,                                    // Files named with just contentId
      `${businessId}_${contentId}`,                // Standard pattern: businessId_contentId
      `${contentId}_`,                             // Files starting with contentId_
      `${businessId}_${contentId}_`,               // Files starting with businessId_contentId_
    ];
    
    // Helper function to match files
    const matchesPattern = (filename: string): boolean => {
      return filePatterns.some(pattern => 
        filename.includes(pattern) || 
        filename.startsWith(pattern) ||
        filename === pattern ||
        filename.startsWith(`${pattern}.`) // Exact match with extension
      );
    };
    
    // Delete images
    console.log('Checking images bucket...');
    const { data: imageFiles, error: imageListError } = await supabase.storage
      .from('images')
      .list('');
    
    if (imageListError) {
      console.error('Error listing image files:', imageListError);
    } else if (imageFiles && imageFiles.length > 0) {
      const imagePaths = imageFiles
        .filter(file => matchesPattern(file.name))
        .map(file => file.name);
      
      console.log(`Found ${imagePaths.length} image files to delete:`, imagePaths);
      
      if (imagePaths.length > 0) {
        const { error: imageDeleteError } = await supabase.storage
          .from('images')
          .remove(imagePaths);
        
        if (imageDeleteError) {
          console.error('Error deleting image files:', imageDeleteError);
        } else {
          console.log(`Successfully deleted ${imagePaths.length} image files`);
        }
      }
    }

    // Delete videos  
    console.log('Checking videos bucket...');
    const { data: videoFiles, error: videoListError } = await supabase.storage
      .from('videos')
      .list('');
    
    if (videoListError) {
      console.error('Error listing video files:', videoListError);
    } else if (videoFiles && videoFiles.length > 0) {
      const videoPaths = videoFiles
        .filter(file => matchesPattern(file.name))
        .map(file => file.name);
      
      console.log(`Found ${videoPaths.length} video files to delete:`, videoPaths);
      
      if (videoPaths.length > 0) {
        const { error: videoDeleteError } = await supabase.storage
          .from('videos')
          .remove(videoPaths);
        
        if (videoDeleteError) {
          console.error('Error deleting video files:', videoDeleteError);
        } else {
          console.log(`Successfully deleted ${videoPaths.length} video files`);
        }
      }
    }

    // Delete audio files
    console.log('Checking audio bucket...');
    const { data: audioFiles, error: audioListError } = await supabase.storage
      .from('audio')
      .list('');
    
    if (audioListError) {
      console.error('Error listing audio files:', audioListError);
    } else if (audioFiles && audioFiles.length > 0) {
      const audioPaths = audioFiles
        .filter(file => matchesPattern(file.name))
        .map(file => file.name);
      
      console.log(`Found ${audioPaths.length} audio files to delete:`, audioPaths);
      
      if (audioPaths.length > 0) {
        const { error: audioDeleteError } = await supabase.storage
          .from('audio')
          .remove(audioPaths);
        
        if (audioDeleteError) {
          console.error('Error deleting audio files:', audioDeleteError);
        } else {
          console.log(`Successfully deleted ${audioPaths.length} audio files`);
        }
      }
    }

    // Step 2: Delete content assets records
    const { error: assetsError } = await supabase
      .from('content_assets')
      .delete()
      .eq('content_id', contentId);

    if (assetsError) {
      console.error('Error deleting content assets:', assetsError);
      return {
        success: false,
        error: 'Failed to delete content assets. Please try again.',
      };
    }

    // Step 3: Delete content record
    const { error: contentError } = await supabase
      .from('content')
      .delete()
      .eq('id', contentId);

    if (contentError) {
      console.error('Error deleting content:', contentError);
      return {
        success: false,
        error: 'Failed to delete content. Please try again.',
      };
    }

    // Revalidate all content pages
    revalidatePath('/content/drafts');
    revalidatePath('/content/scheduled');
    revalidatePath('/content/partially-published');
    revalidatePath('/content/completed');
    
    return { success: true, error: null };

  } catch (error) {
    console.error('Error deleting content:', error);
    return {
      success: false,
      error: 'Failed to delete content. Please try again.',
    };
  }
}

export async function retryContentProcessing({
  contentId,
}: {
  contentId: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be logged in to retry content.' };
  }

  try {
    // Get the content record first to prepare for retry
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select(`
        *,
        businesses(*)
      `)
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      console.error('Error fetching content for retry:', fetchError);
      return {
        success: false,
        error: 'Content not found.',
      };
    }

    // Reset content generation status to generating
    const { error: statusError } = await supabase
      .from('content')
      .update({ 
        content_generation_status: 'generating',
        error_message: null 
      })
      .eq('id', contentId);

    if (statusError) {
      console.error('Error updating content status for retry:', statusError);
      return {
        success: false,
        error: 'Failed to reset content status.',
      };
    }

    // Trigger N8N workflow again (using existing generateContent logic)
    const webhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;
    
    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_URL_CONTENT_CREATION is not set.');
      return {
        success: false,
        error: 'Webhook URL is not configured.',
      };
    }

    const business = content.businesses;
    if (!business) {
      return {
        success: false,
        error: 'Business information not found.',
      };
    }

    // Prepare payload for N8N (simplified version)
    const payload = {
      contentId: content.id,
      content_title: content.content_title,
      transcript: content.transcript,
      research: content.research,
      video_script: content.video_script,
      keyword: content.keyword,
      business_name: business.name,
      website_url: business.website_url,
      social_media_profiles: business.social_media_profiles,
      social_media_integrations: business.social_media_integrations,
      writing_style_guide: business.writing_style_guide,
      cta_youtube: business.cta_youtube,
      cta_email: business.cta_email,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to trigger N8N workflow:', response.statusText);
      return {
        success: false,
        error: 'Failed to restart content generation.',
      };
    }

    // Revalidate content pages
    revalidatePath('/content/drafts');
    revalidatePath(`/content/${contentId}`);
    
    return { success: true, error: null };

  } catch (error) {
    console.error('Error retrying content processing:', error);
    return {
      success: false,
      error: 'Failed to retry content processing. Please try again.',
    };
  }
} 