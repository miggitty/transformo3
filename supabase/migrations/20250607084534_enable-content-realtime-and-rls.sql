-- The first line enabling replica identity is likely also not needed, but can be left
-- as it doesn't error if already enabled. The 'add table' command is the one causing the error.

-- 2. Create a policy to allow users to see their own content.
-- This is necessary for the real-time subscription to work.
-- Drop the old policy first to avoid conflicts
drop policy if exists "Allow authenticated users to see their own content" on public.content;
-- Create the new, corrected policy
create policy "Allow authenticated users to see their own content"
on public.content
for select
to authenticated
using (
  exists (
    select 1
    from profiles
    where profiles.id = auth.uid() and profiles.business_id = content.business_id
  )
); 