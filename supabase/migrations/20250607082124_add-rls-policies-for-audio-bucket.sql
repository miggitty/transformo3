-- Drop existing policies if they exist to ensure a clean slate for all buckets
DROP POLICY IF EXISTS "Public read access for audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own audio" ON storage.objects;
DROP POLICY IF EXISTS "Allow read access to own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert access to own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow update access to own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete access to own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow full access to own image files" ON storage.objects;
DROP POLICY IF EXISTS "Allow full access to own video files" ON storage.objects;

-- === AUDIO BUCKET POLICIES ===
CREATE POLICY "Allow full access to own audio files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'audio' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid)
WITH CHECK (bucket_id = 'audio' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid);


-- === IMAGES BUCKET POLICIES ===
CREATE POLICY "Allow full access to own image files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'images' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid)
WITH CHECK (bucket_id = 'images' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid);


-- === VIDEOS BUCKET POLICIES ===
CREATE POLICY "Allow full access to own video files"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'videos' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid)
WITH CHECK (bucket_id = 'videos' AND (SELECT business_id FROM public.profiles WHERE id = auth.uid()) = (string_to_array(storage.filename(name), '_'))[1]::uuid); 