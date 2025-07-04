-- Fix RLS security for integration tables
-- Enable RLS on all three integration tables
ALTER TABLE ai_avatar_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_integrations ENABLE ROW LEVEL SECURITY;

-- ===== AI AVATAR INTEGRATIONS POLICIES =====

-- SELECT: Users can view integrations for their business, admins can view all
CREATE POLICY "Users can view their business integrations or admin can view all"
ON ai_avatar_integrations
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = ai_avatar_integrations.business_id OR p.is_admin = true)
    )
);

-- INSERT: Users can create integrations for their business, admins can create for any business
CREATE POLICY "Users can create integrations for their business or admin can create for any"
ON ai_avatar_integrations
FOR INSERT
TO public
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = ai_avatar_integrations.business_id OR p.is_admin = true)
    )
);

-- UPDATE: Users can update their business integrations, admins can update all
CREATE POLICY "Users can update their business integrations or admin can update all"
ON ai_avatar_integrations
FOR UPDATE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = ai_avatar_integrations.business_id OR p.is_admin = true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = ai_avatar_integrations.business_id OR p.is_admin = true)
    )
);

-- DELETE: Users can delete their business integrations, admins can delete all
CREATE POLICY "Users can delete their business integrations or admin can delete all"
ON ai_avatar_integrations
FOR DELETE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = ai_avatar_integrations.business_id OR p.is_admin = true)
    )
);

-- ===== BLOG INTEGRATIONS POLICIES =====

-- SELECT: Users can view integrations for their business, admins can view all
CREATE POLICY "Users can view their business integrations or admin can view all"
ON blog_integrations
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = blog_integrations.business_id OR p.is_admin = true)
    )
);

-- INSERT: Users can create integrations for their business, admins can create for any business
CREATE POLICY "Users can create integrations for their business or admin can create for any"
ON blog_integrations
FOR INSERT
TO public
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = blog_integrations.business_id OR p.is_admin = true)
    )
);

-- UPDATE: Users can update their business integrations, admins can update all
CREATE POLICY "Users can update their business integrations or admin can update all"
ON blog_integrations
FOR UPDATE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = blog_integrations.business_id OR p.is_admin = true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = blog_integrations.business_id OR p.is_admin = true)
    )
);

-- DELETE: Users can delete their business integrations, admins can delete all
CREATE POLICY "Users can delete their business integrations or admin can delete all"
ON blog_integrations
FOR DELETE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = blog_integrations.business_id OR p.is_admin = true)
    )
);

-- ===== EMAIL INTEGRATIONS POLICIES =====

-- SELECT: Users can view integrations for their business, admins can view all
CREATE POLICY "Users can view their business integrations or admin can view all"
ON email_integrations
FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = email_integrations.business_id OR p.is_admin = true)
    )
);

-- INSERT: Users can create integrations for their business, admins can create for any business
CREATE POLICY "Users can create integrations for their business or admin can create for any"
ON email_integrations
FOR INSERT
TO public
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = email_integrations.business_id OR p.is_admin = true)
    )
);

-- UPDATE: Users can update their business integrations, admins can update all
CREATE POLICY "Users can update their business integrations or admin can update all"
ON email_integrations
FOR UPDATE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = email_integrations.business_id OR p.is_admin = true)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = email_integrations.business_id OR p.is_admin = true)
    )
);

-- DELETE: Users can delete their business integrations, admins can delete all
CREATE POLICY "Users can delete their business integrations or admin can delete all"
ON email_integrations
FOR DELETE
TO public
USING (
    EXISTS (
        SELECT 1
        FROM profiles p
        WHERE p.id = auth.uid() 
        AND (p.business_id = email_integrations.business_id OR p.is_admin = true)
    )
);

-- Add comments for documentation
COMMENT ON POLICY "Users can view their business integrations or admin can view all" ON ai_avatar_integrations IS 'RLS policy: Users can only view AI avatar integrations for their business, admins can view all';
COMMENT ON POLICY "Users can view their business integrations or admin can view all" ON blog_integrations IS 'RLS policy: Users can only view blog integrations for their business, admins can view all';
COMMENT ON POLICY "Users can view their business integrations or admin can view all" ON email_integrations IS 'RLS policy: Users can only view email integrations for their business, admins can view all'; 