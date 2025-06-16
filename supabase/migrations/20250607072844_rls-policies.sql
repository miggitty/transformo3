-- Enable RLS and add user/admin policies for all main tables

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can access own profile or admin can access all" ON profiles
  FOR ALL
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- BUSINESSES
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can access own business or admin can access all" ON businesses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.business_id = businesses.id OR p.is_admin = true)
    )
  );

-- CONTENT
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can access own business content or admin can access all" ON content
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND (p.business_id = content.business_id OR p.is_admin = true)
    )
  );

-- CONTENT_ASSETS
ALTER TABLE content_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User can access own business content assets or admin can access all" ON content_assets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN content c ON c.id = content_assets.content_id
        WHERE p.id = auth.uid() AND (p.business_id = c.business_id OR p.is_admin = true)
    )
  ); 