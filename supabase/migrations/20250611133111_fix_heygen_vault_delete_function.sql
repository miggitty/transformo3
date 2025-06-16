-- =================================================================
--          Fix HeyGen Vault Delete Function
-- =================================================================
-- This migration fixes the delete_heygen_key function to use the
-- correct method for deleting secrets from Supabase Vault.
-- The vault.delete_secret() function doesn't exist, so we need to
-- delete directly from the vault.secrets table.
-- =================================================================

-- Drop and recreate the function to delete the HeyGen API key
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
    -- Delete the secret directly from the vault.secrets table
    DELETE FROM vault.secrets WHERE id = v_secret_id;
    -- Clear the reference in the businesses table
    UPDATE public.businesses SET heygen_secret_id = NULL WHERE id = p_business_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_heygen_key(uuid) TO authenticated; 