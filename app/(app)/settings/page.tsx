import { createClient } from '@/utils/supabase/server';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CompanyDetailsForm } from '@/components/shared/settings/company-details-form';
import { DesignColorsForm } from '@/components/shared/settings/design-colors-form';
import { SpeakerDetailsForm } from '@/components/shared/settings/speaker-details-form';
import { SocialMediaForm } from '@/components/shared/settings/social-media-form';
import { CallToActionsForm } from '@/components/shared/settings/call-to-actions-form';
import { EmailSettingsForm } from '@/components/shared/settings/email-settings-form';

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // This case should be handled by middleware, but good to have a safeguard
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Error: Business profile not found.</div>;
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    return <div>Error: Could not load business data.</div>;
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Business Settings</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CompanyDetailsForm business={business} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Design Colors</CardTitle>
          <CardDescription>
            These colors will be used to style your brand assets.
          </CardDescription>
        </CardHeader>
        <DesignColorsForm business={business} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Speaker Details</CardTitle>
        </CardHeader>
        <SpeakerDetailsForm business={business} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social Media</CardTitle>
        </CardHeader>
        <SocialMediaForm business={business} />
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Call To Actions</CardTitle>
        </CardHeader>
        <CallToActionsForm business={business} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <EmailSettingsForm business={business} />
      </Card>
    </div>
  );
}
