import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { createClient } from '@/utils/supabase/server';
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { Tables } from '@/types/supabase';
import { Suspense } from 'react';

export default async function CompletedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>You must be logged in to view this page.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  const businessId = profile?.business_id;

  // Get all content with assets for status determination
  const { data: content, error } = await supabase
    .from('content')
    .select(`
      *,
      content_assets (*)
    `)
    .eq('business_id', businessId || '')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content:', error);
    return <div>Error loading content.</div>;
  }

  // Filter for completed content
  const completedContent = content?.filter(item => {
    const assets = item.content_assets || [];
    
    // Skip processing/failed content
    if (item.status === 'processing' || 
        item.content_generation_status === 'generating' ||
        item.content_generation_status === 'failed' || 
        (item.status === 'completed' && assets.length === 0)) {
      return false;
    }
    
    const sentAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_status === 'Sent');
    
    // Completed: All assets have been sent successfully
    return assets.length > 0 && sentAssets.length === assets.length;
  }) || [];
  
  return (
    <AccessGate 
      feature="content management"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content management requires an active subscription.
          </p>
        </div>
      }
    >
      <Suspense fallback={null}>
        <TrialSuccessBanner />
      </Suspense>
      <Card>
        <CardHeader>
          <CardTitle>Completed Content</CardTitle>
          <CardDescription>
            Content that has been fully published to all platforms. This content is view-only for your records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedContentTable
            serverContent={completedContent.map(item => ({ ...item, content_assets: undefined }))}
            businessId={businessId || ''}
            variant="completed"
            showPagination={true}
            pageSize={50}
          />
        </CardContent>
      </Card>
    </AccessGate>
  );
} 