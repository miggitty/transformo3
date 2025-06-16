-- Make the audio bucket public so external services can access files
UPDATE storage.buckets 
SET public = true 
WHERE id = 'audio'; 