'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { Tables } from '@/types/supabase';

export async function updateBusinessSettings(
  formData: Partial<Tables<'businesses'>>,
  businessId: string,
) {
  const cookieStore = cookies();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('businesses')
    .update(formData)
    .eq('id', businessId)
    .select()
    .single();

  if (error) {
    console.error('Error updating business settings:', error);
    return {
      error: 'Could not update business settings. Please try again.',
    };
  }

  // Revalidate the path to show the updated data
  revalidatePath('/dashboard/settings');

  return {
    data,
    message: 'Settings updated successfully.',
  };
} 