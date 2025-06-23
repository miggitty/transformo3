-- =================================================================
--          Add Facebook Page ID to Upload Post Profiles
-- =================================================================
-- This migration adds facebook_page_id field to upload_post_profiles
-- table for storing Facebook Page IDs used in n8n workflows.
-- =================================================================

-- Step 1: Add facebook_page_id column
-- -----------------------------------------------------------------
ALTER TABLE public.upload_post_profiles 
ADD COLUMN facebook_page_id TEXT;

-- Step 2: Add comment explaining the field
-- -----------------------------------------------------------------
COMMENT ON COLUMN public.upload_post_profiles.facebook_page_id IS 'Primary Facebook Page ID for this profile, used in n8n workflows for Facebook posting';

-- Step 3: Add index for efficient lookups
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_upload_post_profiles_facebook_page_id 
ON public.upload_post_profiles (facebook_page_id) 
WHERE facebook_page_id IS NOT NULL;

-- Step 4: Add constraint to ensure facebook_page_id format (optional)
-- -----------------------------------------------------------------
ALTER TABLE public.upload_post_profiles 
ADD CONSTRAINT chk_facebook_page_id_format 
CHECK (facebook_page_id IS NULL OR facebook_page_id ~ '^[0-9]+$'); 