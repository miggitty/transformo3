-- =================================================================
--          Upload-Post Username Format Migration
-- =================================================================
-- This migration updates the username generation for upload-post
-- to use business names instead of "transformo" prefix.
-- KEEPS existing upload_post_profiles table structure.
-- =================================================================

-- Step 1: Create username generation function
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_upload_post_username(
    p_business_name TEXT,
    p_business_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_sanitized_name TEXT;
    v_business_id_suffix TEXT;
    v_username TEXT;
BEGIN
    -- Sanitize business name: lowercase, replace spaces with underscores, remove special chars
    v_sanitized_name := lower(p_business_name);
    v_sanitized_name := regexp_replace(v_sanitized_name, '\s+', '_', 'g'); -- Replace spaces with underscores
    v_sanitized_name := regexp_replace(v_sanitized_name, '[^a-z0-9_]', '', 'g'); -- Remove non-alphanumeric except underscores
    
    -- Get last 8 characters of business ID (remove hyphens first)
    v_business_id_suffix := right(replace(p_business_id::text, '-', ''), 8);
    
    -- Combine sanitized business name with business ID suffix
    v_username := v_sanitized_name || '_' || v_business_id_suffix;
    
    -- Ensure minimum length (if business name is empty after sanitization, use fallback)
    IF length(v_sanitized_name) = 0 THEN
        v_username := 'business_' || v_business_id_suffix;
    END IF;
    
    RETURN v_username;
END;
$$;

COMMENT ON FUNCTION public.generate_upload_post_username(TEXT, UUID) IS 'Generate upload-post username from business name and ID';

-- Step 2: Update upload_post_profiles table comment
-- -----------------------------------------------------------------
COMMENT ON COLUMN public.upload_post_profiles.upload_post_username IS 'Username in upload-post system (format: {business_name_with_underscores}_{last_8_digits_of_business_id})';

-- Step 3: Grant permissions
-- -----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.generate_upload_post_username(TEXT, UUID) TO authenticated, service_role;

-- No data migration needed in development environment
-- Existing upload_post_profiles table structure remains unchanged
-- New usernames will be generated using the new format going forward 