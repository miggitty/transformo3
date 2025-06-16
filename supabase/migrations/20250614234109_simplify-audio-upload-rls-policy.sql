-- Drop all previous, incorrect policies and functions to ensure a clean state.
DROP POLICY IF EXISTS "Allow full access to own audio files" ON storage.objects;
DROP FUNCTION IF EXISTS get_business_id_for_content(uuid);
DROP POLICY IF EXISTS "Allow authenticated uploads to own business audio folder" ON storage.objects;

-- A simpler, more robust RLS policy for the 'audio' bucket.
-- This policy only checks that the business_id in the filename (the first part)
-- matches the business_id of the authenticated user from their profile.
-- This avoids race conditions by not needing to look up the 'content' table.
CREATE POLICY "Allow full access to own audio files"
ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'audio' AND
  (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
  (string_to_array(storage.filename(name), '_'))[1]::uuid
)
WITH CHECK (
  bucket_id = 'audio' AND
  (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = 
  (string_to_array(storage.filename(name), '_'))[1]::uuid
); 