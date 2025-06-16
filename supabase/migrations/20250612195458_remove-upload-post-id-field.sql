-- Migration: Remove upload_post_id field from businesses table
-- This field is no longer needed as we're moving to a new upload-post profiles system

-- Remove upload_post_id field entirely (no longer needed)
ALTER TABLE businesses 
DROP COLUMN IF EXISTS upload_post_id; 