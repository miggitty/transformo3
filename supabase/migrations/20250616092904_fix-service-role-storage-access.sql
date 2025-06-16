-- Fix service role access to storage buckets
-- The issue is that existing RLS policies are blocking service role access
-- Add explicit service role policies that take precedence

-- Service role policies for all buckets (these will take precedence)
CREATE POLICY "Service role full access to images" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'images'::text)
  WITH CHECK (bucket_id = 'images'::text);

CREATE POLICY "Service role full access to videos" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'videos'::text)
  WITH CHECK (bucket_id = 'videos'::text);

CREATE POLICY "Service role full access to audio" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'audio'::text)
  WITH CHECK (bucket_id = 'audio'::text); 