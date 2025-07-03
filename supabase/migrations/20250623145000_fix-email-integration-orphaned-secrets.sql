-- Fix email integration function to handle orphaned vault secrets
-- This prevents the duplicate key constraint error when a secret exists
-- but no integration record exists

-- Drop the existing function
DROP FUNCTION IF EXISTS public.set_email_integration(UUID, TEXT, TEXT, TEXT, TEXT);

-- Create the improved function
CREATE OR REPLACE FUNCTION public.set_email_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_api_key TEXT,
    p_sender_name TEXT DEFAULT NULL,
    p_sender_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_name TEXT;
    v_integration_id UUID;
    v_existing_secret_id UUID;
BEGIN
    -- Validate provider
    IF p_provider NOT IN ('mailerlite', 'mailchimp', 'brevo') THEN
        RAISE EXCEPTION 'Invalid email provider: %', p_provider;
    END IF;
    
    -- Generate the expected secret name
    v_secret_name := 'email_' || p_provider || '_key_for_business_' || p_business_id::text;
    
    -- Check if integration already exists
    SELECT id, secret_id INTO v_integration_id, v_secret_id
    FROM public.email_integrations
    WHERE business_id = p_business_id AND provider = p_provider;
    
    -- If no integration exists, check for orphaned secret
    IF v_secret_id IS NULL THEN
        -- Look for existing secret with the expected name
        SELECT id INTO v_existing_secret_id
        FROM vault.secrets
        WHERE name = v_secret_name;
        
        IF v_existing_secret_id IS NOT NULL THEN
            -- Found orphaned secret, update it and use it
            PERFORM vault.update_secret(v_existing_secret_id, p_api_key);
            v_secret_id := v_existing_secret_id;
        ELSE
            -- No existing secret, create new one
            v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'Email provider API key');
        END IF;
    ELSE
        -- Integration exists, update existing secret
        PERFORM vault.update_secret(v_secret_id, p_api_key);
    END IF;
    
    -- Insert or update integration record
    INSERT INTO public.email_integrations (
        business_id,
        provider,
        secret_id,
        sender_name,
        sender_email,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_sender_name,
        p_sender_email,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider) 
    DO UPDATE SET
        secret_id = v_secret_id,
        sender_name = COALESCE(p_sender_name, email_integrations.sender_name),
        sender_email = COALESCE(p_sender_email, email_integrations.sender_email),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.set_email_integration(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Add a cleanup function to remove orphaned secrets
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_email_secrets()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_secret_record RECORD;
BEGIN
    -- Find secrets that match email integration pattern but have no corresponding integration
    FOR v_secret_record IN 
        SELECT s.id, s.name
        FROM vault.secrets s
        WHERE s.name ~ '^email_(mailerlite|mailchimp|brevo)_key_for_business_[a-f0-9-]+$'
        AND NOT EXISTS (
            SELECT 1 FROM public.email_integrations ei 
            WHERE ei.secret_id = s.id
        )
    LOOP
        -- Delete orphaned secret
        DELETE FROM vault.secrets WHERE id = v_secret_record.id;
        v_deleted_count := v_deleted_count + 1;
        
        RAISE NOTICE 'Deleted orphaned email secret: %', v_secret_record.name;
    END LOOP;
    
    RETURN v_deleted_count;
END;
$$;

-- Grant permissions for cleanup function
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_email_secrets() TO authenticated, service_role; 