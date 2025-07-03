import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NewContentButton } from '@/components/shared/new-content-button';
import { createClient } from '@/utils/supabase/server';
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { deleteContent, retryContentProcessing } from '../[id]/actions';
import { Tables } from '@/types/supabase';
import { Suspense } from 'react';
import { determineContentStatus } from '@/lib/content-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';

interface DraftsPageProps {
  searchParams: Promise<{ trial_setup?: string }>;
}

export default async function DraftsPage(props: DraftsPageProps) {
  const searchParams = await props.searchParams;
  const isTrialSuccess = searchParams.trial_setup === 'success';
  
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

  // Filter for draft, processing, and failed content (all appear on drafts page)
  const draftContent = content?.filter(item => {
    const assets = item.content_assets || [];
    const status = determineContentStatus(item, assets);
    
    // Drafts page shows: processing, failed, and draft content
    return status === 'processing' || status === 'failed' || status === 'draft';
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
        
        {isTrialSuccess && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              🎉 <strong>Welcome to Transformo!</strong> Your 7-day free trial is now active. Start creating your first content by clicking "New Content" below.
            </AlertDescription>
          </Alert>
        )}
        
        <h1 className="text-3xl font-bold">Content Drafts</h1>
        
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Draft Content</CardTitle>
            <CardDescription>
              Review and approve your content before scheduling. Processing and failed content also appears here.
            </CardDescription>
          </div>
          <NewContentButton />
        </CardHeader>
        <CardContent>
          <EnhancedContentTable
            serverContent={draftContent}
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
      </div>
    </AccessGate>
  );
} 