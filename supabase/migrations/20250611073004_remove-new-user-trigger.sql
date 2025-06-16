-- Drop the trigger from the auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop the function that the trigger called
DROP FUNCTION IF EXISTS public.handle_new_user(); 