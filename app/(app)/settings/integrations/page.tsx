import { createClient } from '@/utils/supabase/server';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EmailIntegrationForm } from '@/components/shared/settings/email-integration-form';
import { HeygenSettingsForm } from '@/components/shared/settings/heygen-settings-form';
import { BlogIntegrationForm } from '@/components/shared/settings/blog-integration-form';
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

  // Get email integration data separately
  const { data: emailIntegration } = await supabase
    .from('email_integrations')
    .select('id, provider, sender_name, sender_email, selected_group_id, selected_group_name, status, validated_at')
    .eq('business_id', profile.business_id)
    .eq('status', 'active')
    .single();

  // Get AI avatar integration data separately
  const { data: aiAvatarIntegration } = await supabase
    .from('ai_avatar_integrations')
    .select('id, provider, avatar_id, voice_id, status, validated_at')
    .eq('business_id', profile.business_id)
    .eq('provider', 'heygen')
    .eq('status', 'active')
    .single();

  // Transform the data for backward compatibility
  const transformedBusiness = {
    ...business,
    // Map email integration fields for component compatibility
    email_provider: emailIntegration?.provider || null,
    email_sender_name: emailIntegration?.sender_name || null,
    email_sender_email: emailIntegration?.sender_email || null,
    email_selected_group_id: emailIntegration?.selected_group_id || null,
    email_selected_group_name: emailIntegration?.selected_group_name || null,
    email_validated_at: emailIntegration?.validated_at || null,
    email_secret_id: emailIntegration?.id ? 'exists' : null, // Indicate if integration exists
    
    // Map AI avatar integration fields for component compatibility
    heygen_avatar_id: aiAvatarIntegration?.avatar_id || null,
    heygen_voice_id: aiAvatarIntegration?.voice_id || null,
    heygen_secret_id: aiAvatarIntegration?.id ? 'exists' : null, // Indicate if integration exists
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Integrations</h1>
      
      <ErrorBoundary>
        <SocialMediaIntegrationWrapper />
      </ErrorBoundary>
      
      <Card>
        <CardHeader>
          <CardTitle>Email Integration</CardTitle>
          <CardDescription>
            Connect your email service provider for marketing campaigns.
          </CardDescription>
        </CardHeader>
        <EmailIntegrationForm business={transformedBusiness} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Avatar Video Generation</CardTitle>
          <CardDescription>
            Configure your HeyGen integration for AI avatar video generation with custom avatars and voices.
          </CardDescription>
        </CardHeader>
        <HeygenSettingsForm business={transformedBusiness} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blog Integration</CardTitle>
          <CardDescription>
            Connect your blog platform to automatically publish blog posts and content.
          </CardDescription>
        </CardHeader>
        <BlogIntegrationForm business={business} />
      </Card>
    </div>
  );
} 