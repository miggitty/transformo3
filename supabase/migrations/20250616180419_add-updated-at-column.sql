-- Add updated_at column to content table
ALTER TABLE content 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing records to have an updated_at value
UPDATE content SET updated_at = created_at WHERE updated_at IS NULL;

-- Create trigger to automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_updated_at 
    BEFORE UPDATE ON content 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 