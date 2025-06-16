-- Fix RLS policy for content_assets using a more reliable approach for upsert operations
-- The issue might be with the complex join in the policy during WITH CHECK evaluation

-- Drop the existing policy
DROP POLICY IF EXISTS "User can access own business content assets or admin can access all" ON content_assets;
DROP POLICY IF EXISTS "User can access own business content assets or admin can access" ON content_assets;

-- Create separate policies for better control
-- Policy for SELECT/UPDATE operations
CREATE POLICY "content_assets_select_update" ON content_assets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  );

-- Policy for UPDATE operations
CREATE POLICY "content_assets_update" ON content_assets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  );

-- Policy for INSERT operations - this is the critical one for upsert
CREATE POLICY "content_assets_insert" ON content_assets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  );

-- Policy for DELETE operations
CREATE POLICY "content_assets_delete" ON content_assets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  ); 