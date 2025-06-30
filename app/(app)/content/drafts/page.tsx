import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { deleteContent, retryContentProcessing } from '../[id]/actions';
import { Tables } from '@/types/supabase';
import { Suspense } from 'react';

export default async function DraftsPage() {
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

  // Filter for draft and failed content (both appear on drafts page)
  const draftContent = content?.filter(item => {
    const assets = item.content_assets || [];
    
    // Processing or generating content
    if (item.status === 'processing' || item.content_generation_status === 'generating') {
      return false;
    }
    
    // Failed content appears here
    if (item.content_generation_status === 'failed' || 
        (item.status === 'completed' && assets.length === 0)) {
      return true;
    }
    
    // Draft content (completed but not scheduled)
    const scheduledAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_scheduled_at);
    const sentAssets = assets.filter((asset: Tables<'content_assets'>) => asset.asset_status === 'Sent');
    
    if (assets.length > 0 && sentAssets.length === assets.length) {
      return false; // completed
    }
    
    if (sentAssets.length > 0 && sentAssets.length < assets.length) {
      return false; // partially published
    }
    
    if (scheduledAssets.length > 0 && sentAssets.length === 0) {
      return false; // scheduled
    }
    
    return true; // draft
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Draft Content</CardTitle>
            <CardDescription>
              Review and approve your content before scheduling. Failed content also appears here with retry options.
            </CardDescription>
          </div>
          <Link href="/new">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Content
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <EnhancedContentTable
            serverContent={draftContent.map(item => ({ ...item, content_assets: undefined }))}
            businessId={businessId || ''}
            variant="drafts"
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