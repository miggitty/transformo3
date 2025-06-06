-- Migration: Create full schema for businesses, profiles, content, and content_assets

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  website_url text,
  contact_email text,
  social_username text,
  social_media_profiles jsonb,
  social_media_integrations jsonb,
  writing_style_guide text,
  cta_youtube text,
  cta_email text,
  cta_social text
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  is_admin boolean default false
);

create table if not exists content (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  business_id uuid references businesses(id),
  content_title text,
  status text,
  transcript text,
  research text,
  video_script text,
  keyword text,
  audio_url text,
  heygen_url text,
  video_long_url text,
  video_short_url text,
  error_message text,
  scheduled_at timestamptz,
  published_at timestamptz
);

create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  content_id uuid references content(id),
  name text,
  asset_status text,
  content_type text,
  headline text,
  headline_prompt text,
  content text,
  content_prompt text,
  image_url text,
  image_prompt text,
  blog_url text,
  blog_meta_description text,
  error_message text,
  asset_scheduled_at timestamptz,
  asset_published_at timestamptz
); 