-- Alternative approach: Add a comprehensive policy that allows service role access
-- The issue is that the existing policies are too restrictive and don't account for service role

-- Update the existing policies to include service role bypass
-- Images
DROP POLICY IF EXISTS "Allow full access to own image files" ON storage.objects;
CREATE POLICY "Allow full access to own image files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'images'::text AND 
    (
      -- Allow if it's the service role (bypass all checks)
      current_setting('role', true) = 'service_role' OR
      -- Or if user owns the file (business_id prefix in filename)
      (( SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  )
  WITH CHECK (
    bucket_id = 'images'::text AND 
    (
      -- Allow if it's the service role (bypass all checks)
      current_setting('role', true) = 'service_role' OR
      -- Or if user owns the file (business_id prefix in filename)
      (( SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
       ((string_to_array(storage.filename(name), '_'::text))[1])::uuid)
    )
  );

-- Also update the simple upload policy for images
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'images'::text AND 
    (
      -- Allow if it's the service role (bypass all checks)
      current_setting('role', true) = 'service_role' OR
      -- Or allow all authenticated users to upload to images bucket
      true
    )
  ); 