'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { Tables } from '@/types/supabase';

export async function updateBusinessSettings(
  formData: Partial<Tables<'businesses'>>,
  businessId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('businesses')
    .update(formData)
    .eq('id', businessId)
    .select()
    .single();

  if (error) {
    console.error('Error updating business settings:', error);
    return { error: 'Could not update business settings.' };
  }

  revalidatePath('/settings/business');
  return { data };
} 