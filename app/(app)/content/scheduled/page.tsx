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
import { deleteContent } from '../[id]/actions';
import { Tables } from '@/types/supabase';
import { Suspense } from 'react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ScheduledPage() {
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

  // Filter for scheduled content using simplified status logic
  const scheduledContent = content?.filter(item => {
    const assets = item.content_assets || [];
    
    // Skip processing/failed content
    if (item.status === 'processing' || item.status === 'failed') {
      return false;
    }
    
    // For draft content, check if it has scheduled assets
    if (item.status === 'draft') {
      const scheduledAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_scheduled_at);
      const sentAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_status === 'Sent');
      
      // Scheduled: Assets have scheduled dates but none sent yet
      return scheduledAssets.length > 0 && sentAssets.length === 0;
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
        
        <h1 className="text-3xl font-bold">Content Schedule</h1>
        
        <Card>
        <CardHeader>
          <CardTitle>Scheduled Content</CardTitle>
          <CardDescription>
            Content that has been scheduled for publication. You can edit scheduled content directly and changes will be saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedContentTable
            serverContent={scheduledContent.map(item => ({ ...item, content_assets: undefined }))}
            businessId={businessId || ''}
            variant="scheduled"
            showPagination={true}
            pageSize={50}
            onDelete={async (contentId: string) => {
              'use server';
              return await deleteContent({ contentId, businessId: businessId || '' });
            }}
          />
        </CardContent>
      </Card>
      </div>
    </AccessGate>
  );
} 