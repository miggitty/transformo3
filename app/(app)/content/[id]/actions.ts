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