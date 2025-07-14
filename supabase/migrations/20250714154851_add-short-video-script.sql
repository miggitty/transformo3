-- Add short_video_script field to content table
-- This field will store the script content for short social videos, separate from the main video script

ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS short_video_script TEXT;

-- Add index for performance (only for non-null values)
CREATE INDEX IF NOT EXISTS idx_content_short_video_script 
ON public.content(short_video_script) 
WHERE short_video_script IS NOT NULL;

-- RLS policies inherit from existing content table policies
-- No additional RLS policies needed as this is just a new field 