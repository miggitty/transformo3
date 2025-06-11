-- =================================================================
--          Fix HeyGen Delete Function Order
-- =================================================================
-- This migration fixes the order of operations in delete_heygen_key
-- to avoid foreign key constraint violations. We must clear the
-- reference in businesses table BEFORE deleting from vault.secrets.
-- =================================================================

-- Drop and recreate the function with correct order
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
    -- FIRST: Clear the reference in the businesses table to avoid FK constraint violation
    UPDATE public.businesses SET heygen_secret_id = NULL WHERE id = p_business_id;
    -- THEN: Delete the secret from vault.secrets
    DELETE FROM vault.secrets WHERE id = v_secret_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_heygen_key(uuid) TO authenticated; 