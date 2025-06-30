-- Add project_type field to content table
-- This enables differentiating between voice recording and video upload projects

-- Add the project_type column with default value for backward compatibility
ALTER TABLE content 
ADD COLUMN project_type TEXT DEFAULT 'voice_recording';

-- Add check constraint to ensure only valid project types
ALTER TABLE content 
ADD CONSTRAINT content_project_type_check 
CHECK (project_type IN ('voice_recording', 'video_upload'));

-- Add index for performance when filtering by project type
CREATE INDEX idx_content_project_type ON content(project_type);

-- Add comment to document the field
COMMENT ON COLUMN content.project_type IS 'Project type: voice_recording (audio-based) or video_upload (video-based)'; 