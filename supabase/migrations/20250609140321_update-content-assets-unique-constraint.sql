-- Drop the old single-column unique constraint
ALTER TABLE public.content_assets
DROP CONSTRAINT IF EXISTS unique_content_id;

-- Add a new composite unique constraint on both content_id and content_type
ALTER TABLE public.content_assets
ADD CONSTRAINT content_assets_content_id_content_type_key UNIQUE (content_id, content_type); 