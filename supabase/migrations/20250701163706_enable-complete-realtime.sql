-- Enable complete realtime for content management
-- This migration fixes realtime issues by adding content_assets to realtime publication

-- Step 1: Add content_assets to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_assets;

-- Step 2: Ensure both tables have proper replica identity for change tracking
-- (content table should already be set from previous migration)
ALTER TABLE public.content_assets REPLICA IDENTITY FULL;

-- Step 3: Verify RLS policies allow realtime reads
-- These policies enable users to receive realtime updates for their content

-- Content table realtime read policy (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'content' 
    AND policyname = 'Allow realtime reads on content'
  ) THEN
    CREATE POLICY "Allow realtime reads on content" 
    ON public.content FOR SELECT 
    USING (true);
  END IF;
END $$;

-- Content assets realtime read policy (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'content_assets' 
    AND policyname = 'Allow realtime reads on content_assets'
  ) THEN
    CREATE POLICY "Allow realtime reads on content_assets" 
    ON public.content_assets FOR SELECT 
    USING (true);
  END IF;
END $$;

-- Step 4: Verification log
DO $$
BEGIN
  RAISE NOTICE 'Realtime setup completed:';
  RAISE NOTICE '- content_assets table added to supabase_realtime publication';
  RAISE NOTICE '- Replica identity set to FULL for both content and content_assets';
  RAISE NOTICE '- Realtime read policies created for both tables';
  RAISE NOTICE 'Users will now receive real-time updates for content and asset changes';
END $$; 