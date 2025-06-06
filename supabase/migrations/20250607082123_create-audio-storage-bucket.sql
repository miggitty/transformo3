-- Create storage buckets if they don't exist.
-- This ensures that the setup is reproducible from migrations alone.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('audio', 'audio', false),
  ('videos', 'videos', false),
  ('images', 'images', false)
ON CONFLICT (id) DO NOTHING; 