-- =================================================================
--          Fix Content Assets RLS for Service Role
-- =================================================================
-- This migration adds service role bypass to content_assets policies
-- to allow n8n automation to work properly.
-- =================================================================

-- Fix INSERT policy for content_assets
DROP POLICY IF EXISTS "content_assets_insert" ON content_assets;
CREATE POLICY "content_assets_insert" ON content_assets
FOR INSERT 
WITH CHECK (
  -- Allow service role to bypass RLS entirely
  auth.role() = 'service_role'
  OR 
  -- Original logic for authenticated users
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN content c ON c.id = content_assets.content_id
    WHERE p.id = auth.uid() 
      AND (p.business_id = c.business_id OR p.is_admin = true)
  )
);

-- Fix SELECT policy for content_assets  
DROP POLICY IF EXISTS "content_assets_select" ON content_assets;
CREATE POLICY "content_assets_select" ON content_assets
FOR SELECT 
USING (
  -- Allow service role to bypass RLS entirely
  auth.role() = 'service_role'
  OR
  -- Original logic for authenticated users
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN content c ON c.id = content_assets.content_id
    WHERE p.id = auth.uid() 
      AND (p.business_id = c.business_id OR p.is_admin = true)
  )
);

-- Fix UPDATE policy for content_assets
DROP POLICY IF EXISTS "content_assets_update" ON content_assets;
CREATE POLICY "content_assets_update" ON content_assets
FOR UPDATE 
USING (
  -- Allow service role to bypass RLS entirely
  auth.role() = 'service_role'
  OR
  -- Original logic for authenticated users
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN content c ON c.id = content_assets.content_id
    WHERE p.id = auth.uid() 
      AND (p.business_id = c.business_id OR p.is_admin = true)
  )
)
WITH CHECK (
  -- Allow service role to bypass RLS entirely
  auth.role() = 'service_role'
  OR
  -- Original logic for authenticated users
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN content c ON c.id = content_assets.content_id
    WHERE p.id = auth.uid() 
      AND (p.business_id = c.business_id OR p.is_admin = true)
  )
);

-- Fix DELETE policy for content_assets
DROP POLICY IF EXISTS "content_assets_delete" ON content_assets;
CREATE POLICY "content_assets_delete" ON content_assets
FOR DELETE 
USING (
  -- Allow service role to bypass RLS entirely
  auth.role() = 'service_role'
  OR
  -- Original logic for authenticated users
  EXISTS (
    SELECT 1 
    FROM profiles p
    JOIN content c ON c.id = content_assets.content_id
    WHERE p.id = auth.uid() 
      AND (p.business_id = c.business_id OR p.is_admin = true)
  )
); 