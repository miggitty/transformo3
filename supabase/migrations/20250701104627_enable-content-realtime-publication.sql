-- Enable realtime for content table
-- This migration fixes the core issue where content table was not in the realtime publication

-- Step 1: Set replica identity to FULL for proper change tracking
-- This ensures all column values are included in the realtime payload
ALTER TABLE public.content REPLICA IDENTITY FULL;

-- Step 2: Add content table to the supabase_realtime publication
-- This is what actually enables realtime postgres_changes events
ALTER PUBLICATION supabase_realtime ADD TABLE public.content;

-- Step 3: Verify the setup (for debugging)
-- This will show in logs that content table is now included
DO $$
BEGIN
  RAISE NOTICE 'Content table added to supabase_realtime publication';
  RAISE NOTICE 'Replica identity set to FULL for content table';
END $$; 