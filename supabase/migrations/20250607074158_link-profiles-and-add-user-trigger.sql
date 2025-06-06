-- First, drop the existing RLS policy on profiles if it exists to avoid dependency issues.
DROP POLICY IF EXISTS "User can access own profile or admin can access all" ON public.profiles;

-- Drop the default value and primary key constraint to change the column
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pkey,
  ALTER COLUMN id DROP DEFAULT;

-- Change the profiles.id to reference auth.users.id directly
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Re-add the primary key constraint on the modified id column
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- Recreate a corrected RLS policy for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Function to create a new business and profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_business_id UUID;
BEGIN
  -- Create a new business for the user
  INSERT INTO public.businesses (name)
  VALUES ('My Business') -- A default name for the new business
  RETURNING id INTO new_business_id;

  -- Create a profile linking the user to the new business
  INSERT INTO public.profiles (id, business_id, is_admin)
  VALUES (new.id, new_business_id, TRUE); -- First user is admin of their business
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user(); 