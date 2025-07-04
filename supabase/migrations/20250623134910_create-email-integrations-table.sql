-- =================================================================
--          Email Integrations Table Migration
-- =================================================================
-- This migration creates the specialized email_integrations table
-- for email provider integrations.
-- =================================================================

-- Step 1: Create email_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider and configuration
    provider TEXT NOT NULL CHECK (provider IN ('mailerlite', 'mailchimp', 'brevo')),
    secret_id UUID REFERENCES vault.secrets(id),
    
    -- Sender configuration
    sender_name TEXT,
    sender_email TEXT,
    
    -- Group selection
    selected_group_id TEXT,
    selected_group_name TEXT,
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    validated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_email_provider UNIQUE(business_id, provider)
);

-- Add table comments
COMMENT ON TABLE public.email_integrations IS 'Email service provider integrations (MailerLite, MailChimp, Brevo)';
COMMENT ON COLUMN public.email_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.email_integrations.provider IS 'Email service provider (mailerlite, mailchimp, brevo)';
COMMENT ON COLUMN public.email_integrations.secret_id IS 'Reference to encrypted API key in vault.secrets';
COMMENT ON COLUMN public.email_integrations.status IS 'Integration status (active, inactive, error)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_email_integrations_business_id ON public.email_integrations(business_id);
CREATE INDEX idx_email_integrations_provider ON public.email_integrations(provider);
CREATE INDEX idx_email_integrations_status ON public.email_integrations(status);

-- Step 3: Email integrations table is ready for new data
-- No data migration needed in development environment

-- Step 4: Create RPC functions for email integrations
-- -----------------------------------------------------------------

-- Function to get email integration by business ID
CREATE OR REPLACE FUNCTION public.get_email_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    sender_name TEXT,
    sender_email TEXT,
    selected_group_id TEXT,
    selected_group_name TEXT,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ei.id,
        ei.provider,
        ei.sender_name,
        ei.sender_email,
        ei.selected_group_id,
        ei.selected_group_name,
        ei.status,
        ei.validated_at
    FROM public.email_integrations ei
    WHERE ei.business_id = p_business_id
      AND ei.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get decrypted email secret (updated for new table)
CREATE OR REPLACE FUNCTION public.get_email_secret_v2(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id 
    FROM public.email_integrations 
    WHERE business_id = p_business_id 
      AND status = 'active' 
    LIMIT 1;
    
    IF v_secret_id IS NOT NULL THEN
        SELECT decrypted_secret INTO v_secret_value 
        FROM vault.decrypted_secrets 
        WHERE id = v_secret_id;
        RETURN v_secret_value;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Function to set/update email integration
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
BEGIN
    -- Validate provider
    IF p_provider NOT IN ('mailerlite', 'mailchimp', 'brevo') THEN
        RAISE EXCEPTION 'Invalid email provider: %', p_provider;
    END IF;
    
    -- Check if integration already exists
    SELECT id, secret_id INTO v_integration_id, v_secret_id
    FROM public.email_integrations
    WHERE business_id = p_business_id AND provider = p_provider;
    
    -- Create or update secret in vault
    IF v_secret_id IS NULL THEN
        v_secret_name := 'email_' || p_provider || '_key_for_business_' || p_business_id::text;
        v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'Email provider API key');
    ELSE
        PERFORM vault.update_secret(v_secret_id, p_api_key);
    END IF;
    
    -- Insert or update integration
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

-- Function to delete email integration
CREATE OR REPLACE FUNCTION public.delete_email_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.email_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.email_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_email_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_secret_v2(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_email_integration(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email_integration(UUID) TO authenticated, service_role;

-- Step 5: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_email_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_integrations_updated_at
    BEFORE UPDATE ON public.email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_email_integrations_updated_at(); 