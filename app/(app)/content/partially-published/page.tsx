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
import { deleteContent, retryContentProcessing } from '../[id]/actions';
import { Tables } from '@/types/supabase';
import { Suspense } from 'react';

export default async function PartiallyPublishedPage() {
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

  // Filter for partially published content
  const partiallyPublishedContent = content?.filter(item => {
    const assets = item.content_assets || [];
    
    // Skip processing/failed content
    if (item.status === 'processing' || 
        item.content_generation_status === 'generating' ||
        item.content_generation_status === 'failed' || 
        (item.status === 'completed' && assets.length === 0)) {
      return false;
    }
    
    const sentAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_status === 'Sent');
    
    // Partially Published: Some assets sent, some pending/failed
    return sentAssets.length > 0 && sentAssets.length < assets.length;
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
      
      {/* Page Heading */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Partially Published</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Partially Published Content</CardTitle>
          <CardDescription>
            Content where some assets have been published and others are still pending or failed. You can edit unpublished assets and retry failed ones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedContentTable
            serverContent={partiallyPublishedContent.map(item => ({ ...item, content_assets: undefined }))}
            businessId={businessId || ''}
            variant="partially-published"
            showPagination={true}
            pageSize={50}
            onDelete={async (contentId: string) => {
              'use server';
              return await deleteContent({ contentId, businessId: businessId || '' });
            }}
            onRetry={async (contentId: string) => {
              'use server';
              return await retryContentProcessing({ contentId });
            }}
          />
        </CardContent>
      </Card>
    </AccessGate>
  );
} 