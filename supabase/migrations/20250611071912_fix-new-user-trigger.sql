-- Function to create a new business and profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_business_id UUID;
BEGIN
  -- Create a new business for the user, using the correct column name 'business_name'
  INSERT INTO public.businesses (business_name)
  VALUES ('My Business') -- A default name for the new business
  RETURNING id INTO new_business_id;

  -- Create a profile linking the user to the new business
  INSERT INTO public.profiles (id, business_id, is_admin)
  VALUES (new.id, new_business_id, TRUE); -- First user is admin of their business
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 