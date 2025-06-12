import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  generateJWTUrl,
  validateBusinessId,
  validateRedirectUrl,
  sanitizeJsonData,
  UploadPostError,
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

function validateAuthenticatedUser(user: any): asserts user is { id: string } {
  if (!user) {
    throw new UploadPostAuthError('User not authenticated');
  }
  
  if (!user.id || typeof user.id !== 'string') {
    throw new UploadPostValidationError('Invalid user ID');
  }
}

function validateBusinessProfile(profile: any) {
  if (!profile || !profile.business_id) {
    throw new UploadPostValidationError('Business profile not found or invalid');
  }
  
  // Validate business_id format
  validateBusinessId(profile.business_id);
}

function sanitizeProfileData(profile: any) {
  return {
    ...profile,
    social_accounts: sanitizeJsonData(profile.social_accounts),
    upload_post_username: profile.upload_post_username?.trim() || '',
  };
}

function validateJWTOptions(options: any): any {
  if (!options || typeof options !== 'object') {
    return {};
  }

  const validatedOptions: any = {};

  // Validate redirectUrl if provided
  if (options.redirectUrl && typeof options.redirectUrl === 'string') {
    try {
      validatedOptions.redirectUrl = validateRedirectUrl(options.redirectUrl);
    } catch (error) {
      throw new UploadPostValidationError(`Invalid redirect URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Validate logoImage if provided (basic URL validation)
  if (options.logoImage && typeof options.logoImage === 'string') {
    try {
      new URL(options.logoImage);
      validatedOptions.logoImage = options.logoImage;
    } catch {
      throw new UploadPostValidationError('Invalid logo image URL');
    }
  }

  // Validate redirectButtonText (sanitize)
  if (options.redirectButtonText && typeof options.redirectButtonText === 'string') {
    validatedOptions.redirectButtonText = options.redirectButtonText.trim().slice(0, 100); // Limit length
  }

  // Validate platforms array
  if (options.platforms && Array.isArray(options.platforms)) {
    const allowedPlatforms = ['facebook', 'instagram', 'twitter', 'youtube', 'linkedin', 'tiktok'];
    validatedOptions.platforms = options.platforms
      .filter((platform: any) => typeof platform === 'string' && allowedPlatforms.includes(platform.toLowerCase()))
      .map((platform: string) => platform.toLowerCase());
      
    if (validatedOptions.platforms.length === 0) {
      delete validatedOptions.platforms; // Use defaults
    }
  }

  return validatedOptions;
}

/**
 * POST /api/upload-post/connect
 * Generate JWT URL for social media connection
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    validateAuthenticatedUser(user);

    // Rate limiting by user ID for JWT generation (more restrictive)
    if (!checkRateLimit(`jwt-generate-${user.id}`, 10, 300000)) { // 10 requests per 5 minutes
      return NextResponse.json(
        { error: 'Rate limit exceeded for connection attempts. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': '300',
            'X-RateLimit-Limit': '10',
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

    // Check if upload-post profile exists
    const { data: uploadPostProfile, error: uploadPostError } = await supabase
      .from('upload_post_profiles')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    if (uploadPostError) {
      if (uploadPostError.code === 'PGRST116') { // No rows found
        return NextResponse.json({ 
          error: 'Upload-post profile not found. Please create a profile first.' 
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

    // Parse and validate request body for custom options (optional)
    let customOptions = {};
    try {
      const contentType = request.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const body = await request.json();
        customOptions = validateJWTOptions(body.options || {});
      }
    } catch (error) {
      if (error instanceof UploadPostValidationError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      // If JSON parsing fails, continue with empty options
    }

    try {
      // Generate JWT URL using the upload-post username
      const jwtResponse = await generateJWTUrl(
        sanitizedProfile.upload_post_username,
        customOptions
      );

      if (!jwtResponse.success) {
        return NextResponse.json(
          { error: 'Failed to generate connection URL' },
          { status: 400 }
        );
      }

      // Update last_synced_at to track connection attempts
      await supabase
        .from('upload_post_profiles')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', sanitizedProfile.id);

      return NextResponse.json({
        success: true,
        access_url: jwtResponse.access_url,
        profile: sanitizedProfile,
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
      
      if (uploadPostError instanceof UploadPostRateLimitError) {
        return NextResponse.json(
          { error: 'Upload-post service temporarily unavailable' },
          { status: 429 }
        );
      }
      
      console.error('Error generating JWT URL:', uploadPostError);
      return NextResponse.json(
        { error: 'Failed to generate connection URL' },
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
    
    console.error('Error in POST /api/upload-post/connect:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 