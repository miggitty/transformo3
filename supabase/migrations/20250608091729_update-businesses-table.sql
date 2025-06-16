-- Rename the 'name' column to 'business_name'
ALTER TABLE public.businesses RENAME COLUMN name TO business_name;

-- Remove the 'social_username' and 'cta_social' columns
ALTER TABLE public.businesses DROP COLUMN IF EXISTS social_username;
ALTER TABLE public.businesses DROP COLUMN IF EXISTS cta_social;

-- Add the new text columns, checking if they exist first to be safe
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_url TEXT,
  ADD COLUMN IF NOT EXISTS cta_social_long TEXT,
  ADD COLUMN IF NOT EXISTS cta_social_short TEXT,
  ADD COLUMN IF NOT EXISTS booking_link TEXT,
  ADD COLUMN IF NOT EXISTS email_name_token TEXT,
  ADD COLUMN IF NOT EXISTS email_sign_off TEXT;

-- Note: The JSON/JSONB fields 'social_media_profiles' and 'social_media_integrations' already exist.
-- The following fields also already exist and were not modified:
-- website_url, contact_email, cta_youtube, cta_email, writing_style_guide. 