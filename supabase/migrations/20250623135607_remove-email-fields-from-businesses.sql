-- =================================================================
--          Email Integration Cleanup Migration
-- =================================================================
-- This migration removes the old email fields from the businesses
-- table now that we're using the specialized email_integrations table.
-- =================================================================

-- Remove email-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS email_provider,
DROP COLUMN IF EXISTS email_secret_id,
DROP COLUMN IF EXISTS email_sender_name,
DROP COLUMN IF EXISTS email_sender_email,
DROP COLUMN IF EXISTS email_selected_group_id,
DROP COLUMN IF EXISTS email_selected_group_name,
DROP COLUMN IF EXISTS email_validated_at;

-- Remove old RPC functions that operated on businesses table
DROP FUNCTION IF EXISTS public.set_email_key(uuid, text);
DROP FUNCTION IF EXISTS public.delete_email_key(uuid);
DROP FUNCTION IF EXISTS public.get_email_secret(uuid);

-- Add comment about the migration
COMMENT ON TABLE public.businesses IS 'Core business information. Email integrations moved to email_integrations table.'; 