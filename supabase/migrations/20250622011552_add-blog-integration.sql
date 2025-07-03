-- =================================================================
--          Blog Integration Feature Migration
-- =================================================================
-- This script sets up all database objects required for the
-- Blog integration using Supabase Vault. It is idempotent
-- and can be safely run on a clean or existing database.
-- =================================================================

-- Step 1: Add new columns to the 'businesses' table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS blog_provider TEXT CHECK (blog_provider IN ('wordpress', 'wix')),
ADD COLUMN IF NOT EXISTS blog_secret_id UUID REFERENCES vault.secrets(id),
ADD COLUMN IF NOT EXISTS blog_site_url TEXT,
ADD COLUMN IF NOT EXISTS blog_username TEXT,
ADD COLUMN IF NOT EXISTS blog_site_name TEXT,
ADD COLUMN IF NOT EXISTS blog_validated_at TIMESTAMP WITH TIME ZONE;

-- Add constraint that username is required for WordPress only
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'businesses_blog_username_check' 
    AND table_name = 'businesses'
  ) THEN
    ALTER TABLE public.businesses 
    ADD CONSTRAINT businesses_blog_username_check 
    CHECK (
      (blog_provider = 'wordpress' AND blog_username IS NOT NULL) OR 
      (blog_provider = 'wix') OR 
      (blog_provider IS NULL)
    );
  END IF;
END $$;

-- Step 2: Create the function to set/update the Blog Platform credentials
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.set_blog_key(uuid, text, text, text);
CREATE OR REPLACE FUNCTION public.set_blog_key(
  p_business_id uuid, 
  p_provider text, 
  p_new_username text, 
  p_new_credential text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_name TEXT;
BEGIN
  SELECT blog_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NULL THEN
    v_secret_name := 'blog_credential_for_business_' || p_business_id::text;
    v_secret_id := vault.create_secret(p_new_credential, v_secret_name, 'Blog platform credential for business');
    UPDATE public.businesses SET blog_secret_id = v_secret_id WHERE id = p_business_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_new_credential);
  END IF;
  
  -- Update non-sensitive fields
  UPDATE public.businesses 
  SET 
    blog_provider = p_provider,
    blog_username = p_new_username,
    blog_validated_at = NOW()
  WHERE id = p_business_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_blog_key(uuid, text, text, text) TO authenticated;

-- Step 3: Create the function to delete the Blog Platform credentials
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_blog_key(uuid);
CREATE OR REPLACE FUNCTION public.delete_blog_key(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT blog_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    -- FIRST: Clear the reference to avoid FK constraint violation
    UPDATE public.businesses SET 
      blog_secret_id = NULL,
      blog_provider = NULL,
      blog_site_url = NULL,
      blog_username = NULL,
      blog_site_name = NULL,
      blog_validated_at = NULL
    WHERE id = p_business_id;
    -- THEN: Delete the secret from vault.secrets
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_blog_key(uuid) TO authenticated;

-- Step 4: Create the function to retrieve the Blog Platform credentials (for n8n workflows)
-- -----------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_blog_secret(uuid);
CREATE OR REPLACE FUNCTION public.get_blog_secret(p_business_id uuid)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
  v_secret_id UUID;
  v_secret_value TEXT;
BEGIN
  SELECT blog_secret_id INTO v_secret_id FROM public.businesses WHERE id = p_business_id;
  IF v_secret_id IS NOT NULL THEN
    SELECT decrypted_secret INTO v_secret_value FROM vault.decrypted_secrets WHERE id = v_secret_id;
    RETURN v_secret_value;
  END IF;
  RETURN NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_blog_secret(uuid) TO authenticated; 