-- Add approval field to content_assets table for scheduling workflow
-- This field is required before content can be scheduled

ALTER TABLE content_assets 
ADD COLUMN approved BOOLEAN DEFAULT FALSE;

-- Add index for performance when filtering by approval status
CREATE INDEX idx_content_assets_approved ON content_assets(approved);

-- Add comment for clarity
COMMENT ON COLUMN content_assets.approved IS 'Indicates if the content asset has been approved by user for scheduling. Required before scheduling.'; 