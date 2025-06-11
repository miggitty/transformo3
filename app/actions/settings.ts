'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const heygenSettingsFormSchema = z.object({
  heygen_api_key: z.string().optional(),
  heygen_avatar_id: z.string().min(1, 'Avatar ID is required.'),
  heygen_voice_id: z.string().min(1, 'Voice ID is required.'),
});

// Action to update settings
export async function updateHeygenSettings(
  businessId: string,
  formData: z.infer<typeof heygenSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = heygenSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }
  const { heygen_api_key, heygen_avatar_id, heygen_voice_id } = parsedData.data;

  // Only update the secret if a new key was provided.
  if (heygen_api_key) {
    const { error: rpcError } = await supabase.rpc('set_heygen_key', {
      p_business_id: businessId,
      p_new_key: heygen_api_key,
    });

    if (rpcError) {
      console.error('Error saving secret to Vault:', rpcError);
      return { error: `Database error: ${rpcError.message}` };
    }
  }

  // Always update the non-sensitive fields.
  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      heygen_avatar_id: heygen_avatar_id,
      heygen_voice_id: heygen_voice_id,
    })
    .eq('id', businessId);

  if (updateError) {
    console.error('Error updating business settings:', updateError);
    return { error: `Could not update settings: ${updateError.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}

// Action to remove the API key
export async function removeHeygenApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_heygen_key', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting HeyGen API key:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings');
  return { success: true };
}

// Action to generate HeyGen video (for triggering n8n workflow)
export async function generateHeygenVideo(
  businessId: string,
  contentId: string,
  _script: string
) {
  // TODO: This will trigger the n8n workflow in Phase 3
  // For now, we'll just update the content status to 'processing'
  const supabase = await createClient();

  const { error } = await supabase
    .from('content')
    .update({
      heygen_status: 'processing'
    })
    .eq('id', contentId);

  if (error) {
    console.error('Error updating content status:', error);
    return { error: `Could not start video generation: ${error.message}` };
  }

  revalidatePath(`/content/${contentId}`);
  return { success: true };
} 