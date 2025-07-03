-- =================================================================
--          Fix Blog Integrations Constraint
-- =================================================================
-- This migration fixes the deferrable constraint that prevents
-- ON CONFLICT from working in the set_blog_integration function.
-- =================================================================

-- Drop the existing deferrable constraint
ALTER TABLE public.blog_integrations 
DROP CONSTRAINT IF EXISTS unique_business_blog_provider;

-- Add the constraint back without DEFERRABLE
ALTER TABLE public.blog_integrations 
ADD CONSTRAINT unique_business_blog_provider 
UNIQUE(business_id, provider, status);

-- Update the comment to reflect the fix
COMMENT ON TABLE public.blog_integrations IS 'Blog platform integrations (WordPress, Wix) - constraint fixed for ON CONFLICT support'; 