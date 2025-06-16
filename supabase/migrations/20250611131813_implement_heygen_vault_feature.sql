-- =================================================================
--          HeyGen AI Video Feature Migration
-- =================================================================
-- This script sets up all database objects required for the
-- HeyGen integration using Supabase Vault. It is idempotent
-- and can be safely run on a clean or existing database.
-- =================================================================

-- Step 1: Add new columns to the 'businesses' table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS heygen_avatar_id TEXT,
ADD COLUMN IF NOT EXISTS heygen_voice_id TEXT,
ADD COLUMN IF NOT EXISTS heygen_secret_id UUID REFERENCES vault.secrets(id);

-- Step 2: Add new columns to the 'content' table
-- -----------------------------------------------------------------
ALTER TABLE public.content
ADD COLUMN IF NOT EXISTS heygen_video_id TEXT,
ADD COLUMN IF NOT EXISTS heygen_status TEXT;

-- Step 3: Create the function to set/update the HeyGen API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_heygen_key(uuid, text);
CREATE OR REPLACE FUNCTION public.set_heygen_key(p_business_id uuid, p_new_key text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  SELECT heygen_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NULL THEN
    v_secret_name := 'heygen_api_key_for_business_' || p_business_id::text;
    v_secret_id := vault.create_secret(p_new_key, v_secret_name, 'HeyGen API key for business');
    UPDATE public.businesses SET heygen_secret_id = v_secret_id WHERE id = p_business_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_new_key);
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_heygen_key(uuid, text) TO authenticated;

-- Step 4: Create the function to delete the HeyGen API key
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_heygen_key(uuid);
CREATE OR REPLACE FUNCTION public.delete_heygen_key(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT heygen_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    PERFORM vault.delete_secret(v_secret_id);
    UPDATE public.businesses SET heygen_secret_id = NULL WHERE id = p_business_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_heygen_key(uuid) TO authenticated;

-- Step 5: Create the function to retrieve the HeyGen API key (for n8n workflow)
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_business_secret(uuid);
CREATE OR REPLACE FUNCTION public.get_business_secret(p_business_id uuid)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
BEGIN
  SELECT heygen_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_secret_value FROM vault.decrypted_secrets WHERE id = v_secret_id;
    RETURN v_secret_value;
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_business_secret(uuid) TO authenticated; 