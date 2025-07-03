-- Add temporary_image_url field to content_assets table
-- This field stores regenerated images before user confirms the change
ALTER TABLE content_assets 
ADD COLUMN temporary_image_url TEXT;

-- Add comment for clarity
COMMENT ON COLUMN content_assets.temporary_image_url IS 'Temporary storage for regenerated images before user approval. Cleared on save/cancel.'; 