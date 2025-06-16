-- This migration updates the 'videos' bucket to be public for viewing
-- and sets the correct access policies for secure public read access
-- while keeping uploads restricted to authenticated users.

-- Step 1: Update the 'videos' bucket to be public.
UPDATE storage.buckets
SET public = true
WHERE id = 'videos';

-- Step 2: Remove the existing complex RLS policy for videos.
DROP POLICY IF EXISTS "Allow full access to own video files" ON storage.objects;

-- Step 3: Create a policy that allows authenticated users to upload videos.
-- This uses the same business_id pattern as the original policy for security.
CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (
    bucket_id = 'videos' AND 
    (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid
  );

-- Step 4: Create a policy that allows authenticated users to update/delete their own videos.
CREATE POLICY "Authenticated users can manage own videos"
  ON storage.objects FOR UPDATE TO authenticated 
  USING (
    bucket_id = 'videos' AND 
    (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid
  )
  WITH CHECK (
    bucket_id = 'videos' AND 
    (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid
  );

-- Step 5: Create a policy that allows authenticated users to delete their own videos.
CREATE POLICY "Authenticated users can delete own videos"
  ON storage.objects FOR DELETE TO authenticated 
  USING (
    bucket_id = 'videos' AND 
    (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid
  );

-- Step 6: Create a policy that allows anyone to view/read videos (public access).
CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT USING ( bucket_id = 'videos' ); 