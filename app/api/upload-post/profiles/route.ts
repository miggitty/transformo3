import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  createUserProfile, 
  findProfileByUsername,
  validateBusinessId,
  sanitizeJsonData,
  UploadPostAuthError,
  UploadPostValidationError,
  UploadPostRateLimitError,
  generateUploadPostUsername
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

/**
 * GET /api/upload-post/profiles
 * Retrieve user's upload-post profile and social accounts
 */
export async function GET() {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    validateAuthenticatedUser(user);

    // Rate limiting by user ID
    if (!checkRateLimit(`profile-get-${user.id}`, 30, 60000)) { // 30 requests per minute
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '30',
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

    // Check if upload-post profile exists in our database
    const { data: uploadPostProfile, error: uploadPostError } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (uploadPostError && uploadPostError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Database error fetching upload-post profile:', uploadPostError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (!uploadPostProfile) {
      return NextResponse.json({ 
        profile: null,
        social_accounts: {},
        synced: false 
      });
    }

    // Sanitize the profile data
    const sanitizedProfile = sanitizeProfileData(uploadPostProfile);

    // Get fresh data from upload-post API with error handling
    try {
      const uploadPostData = await findProfileByUsername(sanitizedProfile.upload_post_username);
      
      if (uploadPostData) {
        // Sanitize social accounts data
        const sanitizedSocialAccounts = sanitizeJsonData(uploadPostData.social_accounts);
        
        // Update our database with fresh social accounts data
        const { error: updateError } = await supabase
          .from('upload_post_profiles')
          .update({
            social_accounts: sanitizedSocialAccounts,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', sanitizedProfile.id);

        if (updateError) {
          console.error('Error updating social accounts:', updateError);
        }

        return NextResponse.json({
          profile: sanitizedProfile,
          social_accounts: sanitizedSocialAccounts,
          synced: true,
          last_synced_at: new Date().toISOString(),
        });
      } else {
        return NextResponse.json({
          profile: sanitizedProfile,
          social_accounts: sanitizedProfile.social_accounts || {},
          synced: false,
          error: 'Profile not found on upload-post platform'
        });
      }
    } catch (uploadPostError) {
      // Handle specific upload-post errors
      if (uploadPostError instanceof UploadPostAuthError) {
        console.error('Upload-post authentication error:', uploadPostError.message);
        return NextResponse.json({
          profile: sanitizedProfile,
          social_accounts: sanitizedProfile.social_accounts || {},
          synced: false,
          error: 'Upload-post authentication failed',
          last_synced_at: sanitizedProfile.last_synced_at,
        }, { status: 401 });
      }
      
      if (uploadPostError instanceof UploadPostRateLimitError) {
        console.error('Upload-post rate limit:', uploadPostError.message);
        return NextResponse.json({
          profile: sanitizedProfile,
          social_accounts: sanitizedProfile.social_accounts || {},
          synced: false,
          error: 'Upload-post service temporarily unavailable',
          last_synced_at: sanitizedProfile.last_synced_at,
        }, { status: 429 });
      }
      
      console.error('Error fetching from upload-post:', uploadPostError);
      
      // Return cached data if upload-post is unavailable
      return NextResponse.json({
        profile: sanitizedProfile,
        social_accounts: sanitizedProfile.social_accounts || {},
        synced: false,
        error: 'Upload-post service unavailable, showing cached data',
        last_synced_at: sanitizedProfile.last_synced_at,
      });
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
    
    console.error('Error in GET /api/upload-post/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/upload-post/profiles
 * Create new upload-post profile
 */
export async function POST(request: NextRequest) {
  try {
    // Debug request information
    const headers = Object.fromEntries(request.headers.entries());
    console.log('POST /api/upload-post/profiles - Request Debug:', {
      url: request.url,
      method: request.method,
      cookies: headers.cookie || 'No cookies',
      authorization: headers.authorization || 'No authorization header',
      userAgent: headers['user-agent'] || 'No user agent',
    });

    const supabase = await createClient();
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Debug logging
    console.log('POST /api/upload-post/profiles - Auth Debug:', {
      user: user ? { id: user.id, email: user.email } : null,
      authError: authError ? authError.message : null,
    });

    if (!user) {
      console.log('POST /api/upload-post/profiles - No user found in session');
      return NextResponse.json(
        { error: 'User not authenticated. Please sign in and try again.' },
        { status: 401 }
      );
    }

    if (!user.id || typeof user.id !== 'string') {
      console.log('POST /api/upload-post/profiles - Invalid user ID:', user.id);
      return NextResponse.json(
        { error: 'Invalid user session' },
        { status: 401 }
      );
    }

    // Rate limiting by user ID for profile creation (more restrictive)
    if (!checkRateLimit(`profile-create-${user.id}`, 5, 300000)) { // 5 requests per 5 minutes
      return NextResponse.json(
        { error: 'Rate limit exceeded for profile creation. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '300',
            'X-RateLimit-Limit': '5',
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

    // Get business details for username generation
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', profile.business_id)
      .single();

    if (businessError || !business || !business.business_name) {
      console.error('Database error fetching business:', businessError);
      return NextResponse.json(
        { error: 'Business details not found' },
        { status: 404 }
      );
    }

    // Check if profile already exists
    const { data: existingProfile, error: existingError } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('Database error checking existing profile:', existingError);
      return NextResponse.json(
        { error: 'Database error' },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json({ 
        error: 'Upload-post profile already exists for this business',
        profile: sanitizeProfileData(existingProfile)
      }, { status: 409 });
    }

    // Generate username using business name and business_id
    const validatedBusinessId = validateBusinessId(profile.business_id);
    const uploadPostUsername = generateUploadPostUsername(business.business_name, validatedBusinessId);

    try {
      // Create profile on upload-post platform
      const uploadPostResponse = await createUserProfile(uploadPostUsername);
      
      if (!uploadPostResponse.success) {
        return NextResponse.json(
          { error: 'Failed to create profile on upload-post platform' },
          { status: 400 }
        );
      }

      // Store profile in our database
      const { data: newProfile, error: dbError } = await supabase
        .from('upload_post_profiles')
        .insert({
          business_id: validatedBusinessId,
          upload_post_username: uploadPostUsername,
          social_accounts: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbError) {
        console.error('Error storing profile in database:', dbError);
        return NextResponse.json(
          { error: 'Failed to store profile in database' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        profile: sanitizeProfileData(newProfile),
        upload_post_response: uploadPostResponse,
      });

    } catch (uploadPostError) {
      // Handle specific upload-post errors
      if (uploadPostError instanceof UploadPostValidationError) {
        return NextResponse.json(
          { error: `Validation error: ${uploadPostError.message}` },
          { status: 400 }
        );
      }
      
      if (uploadPostError instanceof UploadPostAuthError) {
        return NextResponse.json(
          { error: 'Upload-post authentication failed' },
          { status: 401 }
        );
      }
      
      console.error('Error creating profile on upload-post:', uploadPostError);
      return NextResponse.json(
        { error: 'Failed to create profile on upload-post platform' },
        { status: 400 }
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
    
    console.error('Error in POST /api/upload-post/profiles:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 