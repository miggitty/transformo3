-- Enable RLS on the businesses table if it's not already enabled.
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows any authenticated user to create a new business.
CREATE POLICY "Authenticated users can create businesses"
  ON public.businesses
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create a policy that allows users to view and edit their own business.
-- This checks if the user's ID is in the profiles table associated with the business.
CREATE POLICY "Users can manage their own business"
  ON public.businesses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.business_id = businesses.id AND profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.business_id = businesses.id AND profiles.id = auth.uid()
    )
  ); 