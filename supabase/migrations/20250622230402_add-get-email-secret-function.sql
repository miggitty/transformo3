-- Add RPC function to get decrypted email secrets
CREATE OR REPLACE FUNCTION get_email_secret(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    secret_id UUID;
    decrypted_secret TEXT;
BEGIN
    -- Get the email_secret_id from businesses table
    SELECT email_secret_id INTO secret_id
    FROM businesses
    WHERE id = p_business_id;
    
    -- If no secret_id found, return null
    IF secret_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get the decrypted secret
    SELECT ds.decrypted_secret INTO decrypted_secret
    FROM decrypted_secrets ds
    WHERE ds.id = secret_id;
    
    RETURN decrypted_secret;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_email_secret(UUID) TO service_role; 