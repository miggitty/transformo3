-- Fix storage policies for external uploads (like n8n workflows)
-- Remove conflicting policies and create service-role friendly policies

-- Drop the existing conflicting policies (but keep audio policy from 20250614234109)
DROP POLICY IF EXISTS "Allow full access to own image files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage own videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own videos" ON storage.objects;

-- Create new, more flexible policies that work with service role key
-- and external uploads (like from n8n workflows)

-- Images bucket policies
CREATE POLICY "Service role can manage all images" ON storage.objects
  FOR ALL USING (bucket_id = 'images'::text)
  WITH CHECK (bucket_id = 'images'::text);

CREATE POLICY "Authenticated users can manage their own images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'images'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'images'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  );

-- Videos bucket policies
CREATE POLICY "Service role can manage all videos" ON storage.objects
  FOR ALL USING (bucket_id = 'videos'::text)
  WITH CHECK (bucket_id = 'videos'::text);

CREATE POLICY "Authenticated users can manage their own videos" ON storage.objects
  FOR ALL USING (
    bucket_id = 'videos'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'videos'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT profiles.business_id FROM profiles WHERE profiles.id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  );

-- Audio bucket policies (enhanced version of existing policy from 20250614234109)
-- Update the existing audio policy to also allow service role access
DROP POLICY IF EXISTS "Allow full access to own audio files" ON storage.objects;

CREATE POLICY "Allow full access to own audio files" ON storage.objects
  FOR ALL TO authenticated USING (
    bucket_id = 'audio'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'audio'::text AND 
    (
      -- Service role bypasses this check
      auth.role() = 'service_role'::text OR
      -- User owns the file (business_id prefix in filename)
      (( SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  );

-- Keep the public read policies (they should already exist, so just ensure they're there)
-- Drop and recreate to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view audio" ON storage.objects;

CREATE POLICY "Anyone can view images" ON storage.objects
  FOR SELECT USING (bucket_id = 'images'::text);

CREATE POLICY "Anyone can view videos" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos'::text);

CREATE POLICY "Anyone can view audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio'::text); 