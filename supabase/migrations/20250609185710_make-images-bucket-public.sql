-- This migration updates the 'images' bucket to be public
-- and sets the correct access policies for secure public read access.

-- Step 1: Update the 'images' bucket to be public.
UPDATE storage.buckets
SET public = true
WHERE id = 'images';

-- Step 2: Remove any potentially conflicting old policies on the 'images' bucket.
-- Note: We specify the table as storage.objects and filter by bucket_id.
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view images" ON storage.objects;

-- Step 3: Create a policy that allows authenticated users to upload images.
CREATE POLICY "Authenticated users can upload images"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'images' );

-- Step 4: Create a policy that allows anyone to view/read images.
CREATE POLICY "Anyone can view images"
  ON storage.objects FOR SELECT USING ( bucket_id = 'images' ); 