import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  findProfileByUsername,
  validateBusinessId,
  sanitizeJsonData,
  UploadPostAuthError,
  UploadPostValidationError,
  UploadPostRateLimitError
} from '@/lib/upload-post';

// Rate limiting cache (in production, use Redis or similar)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitCache.get(key);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitCache.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= limit) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function validateAuthenticatedUser(user: unknown): asserts user is { id: string } {
  if (!user) {
    throw new UploadPostAuthError('User not authenticated');
  }
  
  if (!user || typeof user !== 'object' || !('id' in user) || typeof user.id !== 'string') {
    throw new UploadPostValidationError('Invalid user ID');
  }
}

function validateBusinessProfile(profile: unknown) {
  if (!profile || typeof profile !== 'object' || !('business_id' in profile) || !profile.business_id) {
    throw new UploadPostValidationError('Business profile not found or invalid');
  }
  
  // Validate business_id format
  validateBusinessId(profile.business_id as string);
}

function sanitizeProfileData(profile: Record<string, unknown>) {
  return {
    id: profile.id,
    business_id: profile.business_id,
    upload_post_username: typeof profile.upload_post_username === 'string' ? profile.upload_post_username.trim() : '',
    social_accounts: sanitizeJsonData(profile.social_accounts),
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    last_synced_at: profile.last_synced_at,
  };
}

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    validateAuthenticatedUser(user);

    // Rate limiting by user ID for sync operations (moderate restriction)
    if (!checkRateLimit(`sync-${user.id}`, 20, 60000)) { // 20 requests per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded for sync operations. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '20',
            'X-RateLimit-Remaining': '0',
          }
        }
      );
    }

    // Get user's business profile with validation
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Database error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    validateBusinessProfile(profile);

    // Get upload-post profile with validation
    const { data: uploadPostProfile, error: uploadPostError } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (uploadPostError) {
      if (uploadPostError.code === 'PGRST116') { // No rows found
        return NextResponse.json({ 
          error: 'Upload-post profile not found' 
        }, { status: 404 });
      }
      
      console.error('Database error fetching upload-post profile:', uploadPostError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    // Sanitize the profile data
    const sanitizedProfile = sanitizeProfileData(uploadPostProfile);

    // Check if we should skip sync (rate limiting - once per minute)
    const lastSynced = sanitizedProfile.last_synced_at;
    if (lastSynced && typeof lastSynced === 'string') {
      const lastSyncTime = new Date(lastSynced).getTime();
      const oneMinuteAgo = Date.now() - 60 * 1000;
      
      if (lastSyncTime > oneMinuteAgo) {
        // Return cached data if synced within last minute
        return NextResponse.json({
          success: true,
          data: {
            profile: sanitizedProfile,
            social_accounts: sanitizedProfile.social_accounts,
            synced_at: sanitizedProfile.last_synced_at,
            cached: true
          }
        });
      }
    }

    try {
      // Get fresh data from upload-post API
      const uploadPostData = await findProfileByUsername(sanitizedProfile.upload_post_username);
      
      if (!uploadPostData) {
        return NextResponse.json({ 
          error: 'Profile not found on upload-post platform' 
        }, { status: 404 });
      }

      // Sanitize social accounts data
      const sanitizedSocialAccounts = sanitizeJsonData(uploadPostData.social_accounts);

      // Update our database with fresh social accounts data
      const { data: updatedProfile, error: updateError } = await supabase
        .from('upload_post_profiles')
        .update({
          social_accounts: sanitizedSocialAccounts,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', sanitizedProfile.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating social accounts:', updateError);
        return NextResponse.json({ 
          error: `Failed to update social accounts: ${updateError.message}` 
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: {
          profile: sanitizeProfileData(updatedProfile),
          social_accounts: sanitizedSocialAccounts,
          synced_at: new Date().toISOString()
        }
      });

    } catch (uploadPostError) {
      // Handle specific upload-post errors
      if (uploadPostError instanceof UploadPostAuthError) {
        console.error('Upload-post authentication error:', uploadPostError.message);
        return NextResponse.json({
          error: 'Upload-post authentication failed'
        }, { status: 401 });
      }
      
      if (uploadPostError instanceof UploadPostRateLimitError) {
        console.error('Upload-post rate limit:', uploadPostError.message);
        return NextResponse.json({
          error: 'Upload-post service temporarily unavailable'
        }, { status: 429 });
      }
      
      if (uploadPostError instanceof UploadPostValidationError) {
        console.error('Upload-post validation error:', uploadPostError.message);
        return NextResponse.json({
          error: `Validation error: ${uploadPostError.message}`
        }, { status: 400 });
      }
      
      console.error('Error syncing social media accounts:', uploadPostError);
      return NextResponse.json(
        { error: `Could not sync accounts: ${uploadPostError instanceof Error ? uploadPostError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle our custom errors
    if (error instanceof UploadPostAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    if (error instanceof UploadPostValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    
    console.error('Error syncing social media accounts:', error);
    return NextResponse.json(
      { error: `Could not sync accounts: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
} 