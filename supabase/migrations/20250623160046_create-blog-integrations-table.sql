-- =================================================================
--          Blog Integrations Table Migration
-- =================================================================
-- This migration creates the specialized blog_integrations table
-- for blog platform integrations (WordPress, Wix).
-- =================================================================

-- Step 1: Create blog_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.blog_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider information
    provider TEXT NOT NULL CHECK (provider IN ('wordpress', 'wix')),
    
    -- Authentication credentials (stored in vault)
    secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
    
    -- Provider-specific configuration
    username TEXT, -- WordPress application username
    site_url TEXT NOT NULL, -- Blog site URL
    
    -- Provider-specific settings
    provider_config JSONB DEFAULT '{}',
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
    validated_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_blog_provider UNIQUE(business_id, provider, status) DEFERRABLE INITIALLY DEFERRED
);

-- Add table comments
COMMENT ON TABLE public.blog_integrations IS 'Blog platform integrations (WordPress, Wix)';
COMMENT ON COLUMN public.blog_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.blog_integrations.provider IS 'Blog platform provider (wordpress, wix)';
COMMENT ON COLUMN public.blog_integrations.secret_id IS 'Reference to vault secret containing API credentials';
COMMENT ON COLUMN public.blog_integrations.username IS 'Username for the blog platform (WordPress application username)';
COMMENT ON COLUMN public.blog_integrations.site_url IS 'URL of the blog/website';
COMMENT ON COLUMN public.blog_integrations.provider_config IS 'Additional provider-specific configuration';
COMMENT ON COLUMN public.blog_integrations.status IS 'Integration status (active, inactive, error, pending)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_blog_integrations_business_id ON public.blog_integrations(business_id);
CREATE INDEX idx_blog_integrations_provider ON public.blog_integrations(provider);
CREATE INDEX idx_blog_integrations_status ON public.blog_integrations(status);
CREATE INDEX idx_blog_integrations_site_url ON public.blog_integrations(site_url);

-- Step 3: Create RPC functions for blog integrations
-- -----------------------------------------------------------------

-- Function to get blog integration by business ID
CREATE OR REPLACE FUNCTION public.get_blog_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    username TEXT,
    site_url TEXT,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bi.id,
        bi.provider,
        bi.username,
        bi.site_url,
        bi.status,
        bi.validated_at
    FROM public.blog_integrations bi
    WHERE bi.business_id = p_business_id
      AND bi.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get blog secret from vault
CREATE OR REPLACE FUNCTION public.get_blog_secret_v2(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    -- Get secret ID from blog integration
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id
      AND status = 'active'
    LIMIT 1;
    
    IF v_secret_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get secret value from vault
    SELECT decrypted_secret INTO v_secret_value
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;
    
    RETURN v_secret_value;
END;
$$;

-- Function to create/update blog integration
CREATE OR REPLACE FUNCTION public.set_blog_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_credential TEXT,
    p_username TEXT DEFAULT NULL,
    p_site_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_integration_id UUID;
    v_secret_id UUID;
    v_secret_name TEXT;
    v_existing_secret_id UUID;
BEGIN
    -- Validate provider
    IF p_provider NOT IN ('wordpress', 'wix') THEN
        RAISE EXCEPTION 'Invalid blog provider: %', p_provider;
    END IF;
    
    -- Get existing secret ID if integration exists
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id
      AND provider = p_provider
      AND status = 'active';
    
    -- Generate secret name for this business/provider combination
    v_secret_name := 'blog_' || p_provider || '_key_for_business_' || p_business_id::text;
    
    -- Handle secret creation/update with orphaned secret detection
    IF v_secret_id IS NULL THEN
        -- Check if there's an orphaned secret with this name
        SELECT id INTO v_existing_secret_id
        FROM vault.secrets
        WHERE name = v_secret_name;
        
        IF v_existing_secret_id IS NOT NULL THEN
            -- Reuse the orphaned secret
            v_secret_id := v_existing_secret_id;
            PERFORM vault.update_secret(v_secret_id, p_credential);
        ELSE
            -- Create new secret
            v_secret_id := vault.create_secret(p_credential, v_secret_name, 'Blog platform credential');
        END IF;
    ELSE
        -- Update existing secret
        PERFORM vault.update_secret(v_secret_id, p_credential);
    END IF;
    
    -- Insert or update integration
    INSERT INTO public.blog_integrations (
        business_id,
        provider,
        secret_id,
        username,
        site_url,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_username,
        p_site_url,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider, status) 
    DO UPDATE SET
        secret_id = v_secret_id,
        username = COALESCE(p_username, blog_integrations.username),
        site_url = COALESCE(p_site_url, blog_integrations.site_url),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Function to delete blog integration
CREATE OR REPLACE FUNCTION public.delete_blog_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.blog_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_blog_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_blog_secret_v2(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_blog_integration(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_blog_integration(UUID) TO authenticated, service_role;

-- Step 4: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_blog_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_integrations_updated_at
    BEFORE UPDATE ON public.blog_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_integrations_updated_at();

-- No data migration needed in development environment
-- Existing blog integrations will be created fresh using new table structure 