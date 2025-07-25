import { createClient } from '@/utils/supabase/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { userHasAccessToBusiness } from './auth-helpers';

// Re-export for convenience
export { userHasAccessToBusiness };

/**
 * Create Supabase client for API routes with proper cookie handling
 */
function createApiClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // API routes can't set cookies, but we need this for the interface
        },
        remove(name: string, options: CookieOptions) {
          // API routes can't remove cookies, but we need this for the interface
        },
      },
    }
  );
}

/**
 * Authenticate API request and get user
 * Returns error response if not authenticated
 */
export async function authenticateApiRequest(request?: NextRequest) {
  if (!request) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Request context required for API authentication' },
        { status: 500 }
      )
    };
  }

  const supabase = createApiClient(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    };
  }
  
  return { user, error: null };
}

/**
 * Validate user has access to content through business relationship
 * @param userId - The user's ID
 * @param contentId - The content ID to check access for
 * @returns Object with hasAccess boolean and businessId if found
 */
export async function validateContentAccess(userId: string, contentId: string, request?: NextRequest) {
  // Use API client if request is provided, otherwise use server client
  const supabase = request ? createApiClient(request) : await createClient();
  
  // Get content with business_id
  const { data: content, error } = await supabase
    .from('content')
    .select('business_id')
    .eq('id', contentId)
    .single();
  
  if (error || !content) {
    return { hasAccess: false, businessId: null };
  }
  
  // Check if user has access to the business using the same client
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('business_id', content.business_id)
    .single();
  
  const hasAccess = !profileError && !!profile;
  
  return { hasAccess, businessId: content.business_id };
}

/**
 * Validate user has access to content asset through business relationship
 * @param userId - The user's ID
 * @param assetId - The content asset ID to check access for
 * @returns Object with hasAccess boolean and businessId if found
 */
export async function validateContentAssetAccess(userId: string, assetId: string, request?: NextRequest) {
  // Use API client if request is provided, otherwise use server client
  const supabase = request ? createApiClient(request) : await createClient();
  
  console.log('DEBUG: validateContentAssetAccess called with:', { userId, assetId });
  
  // Get content asset with content's business_id
  const { data: asset, error } = await supabase
    .from('content_assets')
    .select(`
      content_id,
      content:content_id (
        business_id
      )
    `)
    .eq('id', assetId)
    .single();
  
  console.log('DEBUG: Asset query result:', { asset, error: error?.message });
  
  if (error || !asset || !asset.content) {
    console.log('DEBUG: Access denied - asset not found or error');
    return { hasAccess: false, businessId: null, contentId: null };
  }
  
  // Check if user has access to the business using the same supabase client
  console.log('DEBUG: Checking business access with API client for:', { userId, businessId: asset.content.business_id });
  
  const { data: businessUser, error: businessError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('business_id', asset.content.business_id)
    .single();
  
  console.log('DEBUG: Profiles query result:', { data: businessUser, error: businessError?.message });
  
  const hasAccess = !businessError && !!businessUser;
  console.log('DEBUG: Business access check:', { userId, businessId: asset.content.business_id, hasAccess });
  
  return { 
    hasAccess, 
    businessId: asset.content.business_id,
    contentId: asset.content_id 
  };
}