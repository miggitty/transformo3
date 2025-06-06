import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { SettingsForm } from '@/components/shared/settings-form';
import { Tables } from '@/types/supabase';

export default async function SettingsPage() {
  const cookieStore = cookies();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  // Fetch the user's profile to get their business_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    // This case should ideally not happen if the trigger is working correctly
    // but it's good practice to handle it.
    // Maybe redirect to an error page or a page to create a business profile.
    return <div>Error: Business profile not found.</div>;
  }

  // Fetch the business details using the business_id from the profile
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    return <div>Error: Could not load business data.</div>;
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
        </CardHeader>
        {/* We pass the fetched business data to the client component */}
        <SettingsForm business={business as Tables<'businesses'>} />
      </Card>
    </div>
  );
}
