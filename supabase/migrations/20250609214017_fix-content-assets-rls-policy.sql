-- Fix RLS policy for content_assets to allow upsert operations
-- The issue is that upsert operations need both USING and WITH CHECK clauses

-- Drop the existing policy
DROP POLICY IF EXISTS "User can access own business content assets or admin can access all" ON content_assets;

-- Create a new policy with both USING and WITH CHECK clauses
CREATE POLICY "User can access own business content assets or admin can access all" ON content_assets
  FOR ALL
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