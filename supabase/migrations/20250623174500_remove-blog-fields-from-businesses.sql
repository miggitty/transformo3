-- =================================================================
--          Remove Blog Fields from Businesses Table
-- =================================================================
-- This migration removes the old blog-related columns from the
-- businesses table after migration to blog_integrations table.
-- =================================================================

-- Remove blog-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS blog_provider,
DROP COLUMN IF EXISTS blog_secret_id,
DROP COLUMN IF EXISTS blog_username,
DROP COLUMN IF EXISTS blog_site_url,
DROP COLUMN IF EXISTS blog_site_name,
DROP COLUMN IF EXISTS blog_validated_at;

-- Remove old RPC functions that used businesses table for blog
DROP FUNCTION IF EXISTS public.set_blog_key(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.delete_blog_key(uuid);
DROP FUNCTION IF EXISTS public.get_blog_secret(uuid);

-- Log cleanup completion
COMMENT ON TABLE public.businesses IS 'Business information and settings. Blog integration moved to blog_integrations table.'; 