-- Simplified Content Status Architecture
-- This migration documents the simplified realtime architecture that uses
-- a single status field approach instead of a complex dual-status system.

-- Add comment explaining the simplified approach
COMMENT ON TABLE content IS 'Content table with simplified status architecture. Status field is the single source of truth: processing -> draft -> scheduled -> completed. N8N updates status directly without app callbacks.';

-- Migration complete: The system uses only the status field
-- N8N workflows should update the database directly with:
-- UPDATE content SET status = 'draft' WHERE id = 'content-id';
