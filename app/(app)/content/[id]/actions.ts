'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Define a schema for the updatable fields
const updatableFields = z.enum(['transcript', 'research', 'video_script']);

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