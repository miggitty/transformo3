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

  // Filter for completed content using simplified status logic
  const completedContent = content?.filter(item => {
    const assets = item.content_assets || [];
    
    // Skip processing/failed content
    if (item.status === 'processing' || item.status === 'failed') {
      return false;
    }
    
    // For draft content, check if all assets have been sent
    if (item.status === 'draft') {
      const sentAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_status === 'Sent');
      
      // Completed: All assets have been sent successfully
      return assets.length > 0 && sentAssets.length === assets.length;
    }
    
    return false;
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
      <div className="flex-1 space-y-8 p-4 md:p-8">
        <Suspense fallback={null}>
          <TrialSuccessBanner />
        </Suspense>
        
        <h1 className="text-3xl font-bold">Completed</h1>
        
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
      </div>
    </AccessGate>
  );
} 