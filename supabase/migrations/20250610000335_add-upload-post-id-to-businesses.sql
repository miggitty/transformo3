-- Migration: Remove upload_post_id from content table and add it to businesses table

-- Remove the field from content table (reversing previous migration)
alter table public.content
drop column if exists upload_post_id;

-- Add upload_post_id to businesses table where it should be
alter table public.businesses
add column upload_post_id text;

-- Add a comment to document the purpose of this field
comment on column public.businesses.upload_post_id is 'ID or reference for uploaded post content associated with this business'; 