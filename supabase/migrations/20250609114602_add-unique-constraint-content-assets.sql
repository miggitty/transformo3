-- Clean up any duplicate content_assets, keeping the most recent one for each content_id
DELETE FROM content_assets 
WHERE id NOT IN (
    SELECT DISTINCT ON (content_id) id 
    FROM content_assets 
    ORDER BY content_id, created_at DESC
);

-- Add unique constraint on content_id to prevent future duplicates
ALTER TABLE content_assets ADD CONSTRAINT unique_content_id UNIQUE (content_id); 