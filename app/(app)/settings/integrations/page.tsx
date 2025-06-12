import { createClient } from '@/utils/supabase/server';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmailIntegrationForm } from '@/components/shared/settings/email-integration-form';
import { HeygenSettingsForm } from '@/components/shared/settings/heygen-settings-form';
import { SocialMediaIntegrationWrapper } from '@/components/shared/settings/social-media-integration-wrapper';
import ErrorBoundary from '@/components/shared/error-boundary';

export default async function IntegrationsPage() {
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
      <h1 className="text-3xl font-bold">Integrations</h1>
      
      <ErrorBoundary>
        <SocialMediaIntegrationWrapper businessId={business.id} />
      </ErrorBoundary>
      
      <Card>
        <CardHeader>
          <CardTitle>Email Integration</CardTitle>
          <CardDescription>
            Connect your email service provider for marketing campaigns.
          </CardDescription>
        </CardHeader>
        <EmailIntegrationForm business={business} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HeyGen AI Video</CardTitle>
          <CardDescription>
            Configure your HeyGen integration for AI avatar video generation.
          </CardDescription>
        </CardHeader>
        <HeygenSettingsForm business={business} />
      </Card>
    </div>
  );
} 