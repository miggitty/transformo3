-- Migration: Create upload_post_profiles table
-- This table manages upload-post profiles for businesses with social media account integration

CREATE TABLE upload_post_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    upload_post_username TEXT NOT NULL UNIQUE,
    social_accounts JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_business_upload_post UNIQUE(business_id)
);

-- Add comments to document the purpose of key fields
COMMENT ON TABLE upload_post_profiles IS 'Stores upload-post profiles and social media account connections for businesses';
COMMENT ON COLUMN upload_post_profiles.upload_post_username IS 'Username in upload-post system (format: transformo_${business_id})';
COMMENT ON COLUMN upload_post_profiles.social_accounts IS 'JSON object containing connected social media accounts from upload-post';
COMMENT ON COLUMN upload_post_profiles.last_synced_at IS 'Timestamp of last sync with upload-post API';

-- Enable Row Level Security
ALTER TABLE upload_post_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their business upload_post_profiles
CREATE POLICY "Users can access their business upload_post_profiles" ON upload_post_profiles
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM profiles 
            WHERE id = auth.uid()
        )
    ); 