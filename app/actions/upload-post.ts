'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { createUserProfile, findProfileByUsername, generateJWTUrl, testConnection } from '@/lib/upload-post';

/**
 * Test the upload-post API connection
 */
export async function testUploadPostConnection() {
  try {
    const isConnected = await testConnection();
    return { success: isConnected };
  } catch (error) {
    console.error('Error testing upload-post connection:', error);
    return { error: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Get upload-post profile for current user's business
 */
export async function getUploadPostProfile() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Get user's business profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.business_id) {
      return { error: 'Business profile not found' };
    }

    // Get upload-post profile from database
    const { data: uploadPostProfile } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    return { data: uploadPostProfile };
  } catch (error) {
    console.error('Error getting upload-post profile:', error);
    return { error: `Could not get profile: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Create upload-post profile for current user's business
 */
export async function createUploadPostProfile() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Get user's business profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.business_id) {
      return { error: 'Business profile not found' };
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (existingProfile) {
      return { error: 'Upload-post profile already exists for this business' };
    }

    // Generate username using business_id
    const uploadPostUsername = `transformo_${profile.business_id}`;

    // Create profile on upload-post platform
    const uploadPostResponse = await createUserProfile(uploadPostUsername);
    
    if (!uploadPostResponse.success) {
      return { error: 'Failed to create profile on upload-post platform' };
    }

    // Store profile in our database
    const { data: newProfile, error: dbError } = await supabase
      .from('upload_post_profiles')
      .insert({
        business_id: profile.business_id,
        upload_post_username: uploadPostUsername,
        social_accounts: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error storing profile in database:', dbError);
      return { error: `Failed to store profile in database: ${dbError.message}` };
    }

    revalidatePath('/settings/integrations');
    return { data: newProfile, upload_post_response: uploadPostResponse };
  } catch (error) {
    console.error('Error creating upload-post profile:', error);
    return { error: `Could not create profile: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Generate JWT URL for social media connection
 */
export async function generateSocialMediaConnectionUrl(customOptions: Record<string, unknown> = {}) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Get user's business profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.business_id) {
      return { error: 'Business profile not found' };
    }

    // Get upload-post profile
    const { data: uploadPostProfile } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (!uploadPostProfile) {
      return { error: 'Upload-post profile not found. Please create a profile first.' };
    }

    // Generate JWT URL
    const jwtResponse = await generateJWTUrl(
      uploadPostProfile.upload_post_username,
      customOptions
    );

    if (!jwtResponse.success) {
      return { error: 'Failed to generate connection URL' };
    }

    // Update last activity timestamp
    await supabase
      .from('upload_post_profiles')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', uploadPostProfile.id);

    return { data: { access_url: jwtResponse.access_url, profile: uploadPostProfile } };
  } catch (error) {
    console.error('Error generating connection URL:', error);
    return { error: `Could not generate connection URL: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

/**
 * Sync social media accounts from upload-post
 */
export async function syncSocialMediaAccounts() {
  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: 'User not authenticated' };
    }

    // Get user's business profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.business_id) {
      return { error: 'Business profile not found' };
    }

    // Get upload-post profile
    const { data: uploadPostProfile } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (!uploadPostProfile) {
      return { error: 'Upload-post profile not found' };
    }

    // Get fresh data from upload-post API
    const uploadPostData = await findProfileByUsername(uploadPostProfile.upload_post_username);
    
    if (!uploadPostData) {
      return { error: 'Profile not found on upload-post platform' };
    }

    // Update our database with fresh social accounts data
    const { data: updatedProfile, error: updateError } = await supabase
      .from('upload_post_profiles')
      .update({
        social_accounts: uploadPostData.social_accounts,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', uploadPostProfile.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating social accounts:', updateError);
      return { error: `Failed to update social accounts: ${updateError.message}` };
    }

    revalidatePath('/settings/integrations');
    return { 
      data: { 
        profile: updatedProfile, 
        social_accounts: uploadPostData.social_accounts,
        synced_at: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error syncing social media accounts:', error);
    return { error: `Could not sync accounts: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
} 