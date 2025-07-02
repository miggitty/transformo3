-- Simplify Content Status Architecture
-- This migration implements the simplified realtime architecture that eliminates
-- the complex dual-status system in favor of a single status field approach.

-- Step 1: Update existing records to use simplified status values
-- Convert content_generation_status values to proper status values

-- Update records where content generation completed successfully
UPDATE content 
SET status = 'draft' 
WHERE content_generation_status = 'completed' 
  AND status = 'processing';

-- Update records where content generation failed
UPDATE content 
SET status = 'failed' 
WHERE content_generation_status = 'failed' 
  AND status != 'failed';

-- Step 2: Remove the content_generation_status column
-- This eliminates the dual-status complexity
ALTER TABLE content DROP COLUMN IF EXISTS content_generation_status;

-- Step 3: Add comment explaining the new simplified approach
COMMENT ON TABLE content IS 'Content table with simplified status architecture. Status field is the single source of truth: processing -> draft -> scheduled -> completed. N8N updates status directly without app callbacks.';

-- Migration complete: The system now uses only the status field
-- N8N workflows should update the database directly with:
-- UPDATE content SET status = 'draft' WHERE id = 'content-id';
