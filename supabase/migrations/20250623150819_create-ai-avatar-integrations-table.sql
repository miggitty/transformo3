-- =================================================================
--          AI Avatar Integrations Table Migration
-- =================================================================
-- This migration creates the specialized ai_avatar_integrations table
-- for AI avatar service integrations.
-- =================================================================

-- Step 1: Create ai_avatar_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.ai_avatar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider and configuration
    provider TEXT NOT NULL CHECK (provider IN ('heygen')),
    secret_id UUID REFERENCES vault.secrets(id),
    
    -- Provider-specific configuration
    avatar_id TEXT,
    voice_id TEXT,
    
    -- Additional provider settings (JSONB for flexibility)
    provider_config JSONB DEFAULT '{}',
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    validated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_ai_avatar_provider UNIQUE(business_id, provider)
);

-- Add table comments
COMMENT ON TABLE public.ai_avatar_integrations IS 'AI avatar video generation service integrations (HeyGen, future providers)';
COMMENT ON COLUMN public.ai_avatar_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.ai_avatar_integrations.provider IS 'AI avatar service provider (heygen)';
COMMENT ON COLUMN public.ai_avatar_integrations.secret_id IS 'Reference to encrypted API key in vault.secrets';
COMMENT ON COLUMN public.ai_avatar_integrations.avatar_id IS 'Provider-specific avatar identifier';
COMMENT ON COLUMN public.ai_avatar_integrations.voice_id IS 'Provider-specific voice identifier';
COMMENT ON COLUMN public.ai_avatar_integrations.provider_config IS 'Additional provider-specific configuration';
COMMENT ON COLUMN public.ai_avatar_integrations.status IS 'Integration status (active, inactive, error)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_ai_avatar_integrations_business_id ON public.ai_avatar_integrations(business_id);
CREATE INDEX idx_ai_avatar_integrations_provider ON public.ai_avatar_integrations(provider);
CREATE INDEX idx_ai_avatar_integrations_status ON public.ai_avatar_integrations(status);

-- Step 3: AI avatar integrations table is ready for new data
-- No data migration needed in development environment

-- Step 4: Create RPC functions for AI avatar integrations
-- -----------------------------------------------------------------

-- Function to get AI avatar integration by business ID
CREATE OR REPLACE FUNCTION public.get_ai_avatar_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    avatar_id TEXT,
    voice_id TEXT,
    provider_config JSONB,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ai.id,
        ai.provider,
        ai.avatar_id,
        ai.voice_id,
        ai.provider_config,
        ai.status,
        ai.validated_at
    FROM public.ai_avatar_integrations ai
    WHERE ai.business_id = p_business_id
      AND ai.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get decrypted AI avatar secret (updated for new table)
CREATE OR REPLACE FUNCTION public.get_ai_avatar_secret(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id 
    FROM public.ai_avatar_integrations 
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

-- Function to set/update AI avatar integration
CREATE OR REPLACE FUNCTION public.set_ai_avatar_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_api_key TEXT,
    p_avatar_id TEXT DEFAULT NULL,
    p_voice_id TEXT DEFAULT NULL,
    p_config JSONB DEFAULT '{}'
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
    IF p_provider NOT IN ('heygen') THEN
        RAISE EXCEPTION 'Invalid AI avatar provider: %', p_provider;
    END IF;
    
    -- Check if integration already exists
    SELECT id, secret_id INTO v_integration_id, v_secret_id
    FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id AND provider = p_provider;
    
    -- Generate secret name for this business/provider combination
    v_secret_name := 'ai_avatar_' || p_provider || '_key_for_business_' || p_business_id::text;
    
    -- Handle secret creation/update with orphaned secret detection
    IF v_secret_id IS NULL THEN
        -- Check if there's an orphaned secret with this name
        SELECT id INTO v_existing_secret_id
        FROM vault.secrets
        WHERE name = v_secret_name;
        
        IF v_existing_secret_id IS NOT NULL THEN
            -- Reuse the orphaned secret
            v_secret_id := v_existing_secret_id;
            PERFORM vault.update_secret(v_secret_id, p_api_key);
        ELSE
            -- Create new secret
            v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'AI avatar provider API key');
        END IF;
    ELSE
        -- Update existing secret
        PERFORM vault.update_secret(v_secret_id, p_api_key);
    END IF;
    
    -- Insert or update integration
    INSERT INTO public.ai_avatar_integrations (
        business_id,
        provider,
        secret_id,
        avatar_id,
        voice_id,
        provider_config,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_avatar_id,
        p_voice_id,
        p_config,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider) 
    DO UPDATE SET
        secret_id = v_secret_id,
        avatar_id = COALESCE(p_avatar_id, ai_avatar_integrations.avatar_id),
        voice_id = COALESCE(p_voice_id, ai_avatar_integrations.voice_id),
        provider_config = COALESCE(p_config, ai_avatar_integrations.provider_config),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Function to delete AI avatar integration
CREATE OR REPLACE FUNCTION public.delete_ai_avatar_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_ai_avatar_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_avatar_secret(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_ai_avatar_integration(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_ai_avatar_integration(UUID) TO authenticated, service_role;

-- Step 5: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_ai_avatar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_avatar_integrations_updated_at
    BEFORE UPDATE ON public.ai_avatar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_avatar_integrations_updated_at(); 