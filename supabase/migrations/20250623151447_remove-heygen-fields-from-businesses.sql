-- =================================================================
--          Remove HeyGen Fields from Businesses Table
-- =================================================================
-- This migration removes the old HeyGen-related columns from the
-- businesses table after migration to ai_avatar_integrations table.
-- =================================================================

-- Remove HeyGen-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS heygen_secret_id,
DROP COLUMN IF EXISTS heygen_avatar_id,
DROP COLUMN IF EXISTS heygen_voice_id;

-- Remove old RPC functions that used businesses table for HeyGen
DROP FUNCTION IF EXISTS public.set_heygen_key(uuid, text);
DROP FUNCTION IF EXISTS public.delete_heygen_key(uuid);
DROP FUNCTION IF EXISTS public.get_heygen_secret(uuid);

-- Log cleanup completion
COMMENT ON TABLE public.businesses IS 'Business information and settings. HeyGen integration moved to ai_avatar_integrations table.'; 