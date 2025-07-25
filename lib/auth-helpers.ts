import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Authenticate the current user and return their details
 * Redirects to sign-in if not authenticated
 */
export async function authenticateUser() {
  const supabase = await createClient();
  
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect('/sign-in');
  }
  
  return user;
}

/**
 * Check if a user has access to a specific business
 * @param userId - The user's ID
 * @param businessId - The business ID to check access for
 * @returns true if the user has access, false otherwise
 */
export async function userHasAccessToBusiness(userId: string, businessId: string): Promise<boolean> {
  const supabase = await createClient();
  
  console.log('DEBUG: Checking business access for:', { userId, businessId });
  
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('business_id', businessId)
    .single();
  
  console.log('DEBUG: Profiles query result:', { data, error: error?.message });
  
  return !error && !!data;
}

/**
 * Validate user has access to a business, throw error if not
 * @param userId - The user's ID
 * @param businessId - The business ID to check access for
 */
export async function validateBusinessAccess(userId: string, businessId: string): Promise<void> {
  const hasAccess = await userHasAccessToBusiness(userId, businessId);
  
  if (!hasAccess) {
    throw new Error('Unauthorized: You do not have access to this business');
  }
}

/**
 * Get the current user and validate business access in one call
 * @param businessId - The business ID to validate access for
 * @returns The authenticated user
 */
export async function authenticateAndValidateBusinessAccess(businessId: string) {
  const user = await authenticateUser();
  await validateBusinessAccess(user.id, businessId);
  return user;
}

/**
 * Get all businesses for a user
 * @param userId - The user's ID
 * @returns Array of businesses the user has access to
 */
export async function getUserBusinesses(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      business:businesses(
        id,
        name,
        slug
      )
    `)
    .eq('id', userId);
  
  if (error) {
    console.error('Error fetching user businesses:', error);
    return [];
  }
  
  return data.map(item => item.business).filter(Boolean);
}