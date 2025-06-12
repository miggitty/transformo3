-- =================================================================
--          Email Integration Feature Migration
-- =================================================================
-- This script sets up all database objects required for the
-- Email integration using Supabase Vault. It is idempotent
-- and can be safely run on a clean or existing database.
-- =================================================================

-- Step 1: Add new columns to the 'businesses' table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS email_provider TEXT CHECK (email_provider IN ('mailerlite', 'mailchimp', 'brevo')),
ADD COLUMN IF NOT EXISTS email_secret_id UUID REFERENCES vault.secrets(id),
ADD COLUMN IF NOT EXISTS email_sender_name TEXT,
ADD COLUMN IF NOT EXISTS email_sender_email TEXT,
ADD COLUMN IF NOT EXISTS email_selected_group_id TEXT,
ADD COLUMN IF NOT EXISTS email_selected_group_name TEXT,
ADD COLUMN IF NOT EXISTS email_validated_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create the function to set/update the Email API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_email_key(uuid, text);
CREATE OR REPLACE FUNCTION public.set_email_key(p_business_id uuid, p_new_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NULL THEN
    v_secret_name := 'email_api_key_for_business_' || p_business_id::text;
    v_secret_id := vault.create_secret(p_new_key, v_secret_name, 'Email provider API key for business');
    UPDATE public.businesses SET email_secret_id = v_secret_id WHERE id = p_business_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_new_key);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_email_key(uuid, text) TO authenticated;

-- Step 3: Create the function to delete the Email API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_email_key(uuid);
CREATE OR REPLACE FUNCTION public.delete_email_key(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    -- FIRST: Clear the reference to avoid FK constraint violation
    UPDATE public.businesses SET email_secret_id = NULL WHERE id = p_business_id;
    -- THEN: Delete the secret from vault.secrets
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_email_key(uuid) TO authenticated;

-- Step 4: Create the function to retrieve the Email API key (for email sending workflows)
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_email_secret(uuid);
CREATE OR REPLACE FUNCTION public.get_email_secret(p_business_id uuid)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
BEGIN
  SELECT email_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_secret_value FROM vault.decrypted_secrets WHERE id = v_secret_id;
    RETURN v_secret_value;
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_email_secret(uuid) TO authenticated; 