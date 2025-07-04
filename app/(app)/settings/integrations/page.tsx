import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmailIntegrationForm } from '@/components/shared/settings/email-integration-form';
import { HeygenSettingsForm } from '@/components/shared/settings/heygen-settings-form';
import ErrorBoundary from '@/components/shared/error-boundary';
import { BlogIntegrationForm } from '@/components/shared/settings/blog-integration-form';
import { SocialMediaIntegrationWrapper } from '@/components/shared/settings/social-media-integration-wrapper';

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    redirect('/sign-in');
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    redirect('/sign-in');
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

  // Get blog integration data separately
  const { data: blogIntegration } = await supabase
    .from('blog_integrations')
    .select('id, provider, username, site_url, status, validated_at')
    .eq('business_id', profile.business_id)
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

    // Map blog integration fields for component compatibility
    blog_provider: blogIntegration?.provider || null,
    blog_username: blogIntegration?.username || null,
    blog_site_url: blogIntegration?.site_url || null,
    blog_secret_id: blogIntegration?.id || null, // Use the actual ID or null
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect your favorite tools and services to streamline your workflow.
        </p>
      </div>
      
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
            Connect your blog or website to automatically publish your content.
          </CardDescription>
        </CardHeader>
        <BlogIntegrationForm business={transformedBusiness} />
      </Card>
    </div>
  );
} 