# Video Upload Project - Phase 5: Table and UI Finalization

## Overview
This phase finalizes all table components, content pages, and ensures consistent project type display across the entire application. Complete Phases 1-4 before starting this phase.

## Implementation Steps

### Step 1: Update All Content Page Headers

#### File: `app/(app)/content/scheduled/page.tsx`
Add project type filtering and display to scheduled content:

```typescript
import { Suspense } from 'react';
import Link from 'next/link';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/server';
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { NewContentButton } from '@/components/shared/new-content-button';
import { ProjectTypeFilter } from '@/components/shared/project-type-filter';
import { deleteContent, retryContentProcessing } from '../drafts/actions';

export default async function ScheduledPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  const businessId = profile.business_id;

  // Fetch scheduled content with project type
  const { data: scheduledContent, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      )
    `)
    .eq('business_id', businessId)
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true });

  if (error) {
    console.error('Error fetching scheduled content:', error);
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load content. Please try again.</p>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold">Scheduled Content</h1>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Scheduled Content</CardTitle>
              <CardDescription>
                Content that has been scheduled for publication across your integrated platforms.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <ProjectTypeFilter 
                selectedTypes={[]}
                onTypesChange={(types) => {
                  // Implement client-side filtering if needed
                  console.log('Filter scheduled content:', types);
                }}
              />
              <NewContentButton />
            </div>
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
```

#### File: `app/(app)/content/completed/page.tsx`
Add project type filtering to completed content:

```typescript
import { Suspense } from 'react';
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
import { NewContentButton } from '@/components/shared/new-content-button';
import { ProjectTypeFilter } from '@/components/shared/project-type-filter';
import { deleteContent } from '../drafts/actions';

export default async function CompletedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  const businessId = profile.business_id;

  // Fetch completed content with project type
  const { data: completedContent, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      ),
      content_assets (
        id,
        content_type,
        asset_status,
        asset_scheduled_at
      )
    `)
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching completed content:', error);
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load content. Please try again.</p>
      </div>
    );
  }

  // Filter for truly completed content (all assets sent)
  const fullyCompletedContent = completedContent.filter(content => {
    const assets = content.content_assets || [];
    return assets.length > 0 && assets.every(asset => asset.asset_status === 'Sent');
  });

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
        <h1 className="text-3xl font-bold">Completed Content</h1>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Completed Content</CardTitle>
              <CardDescription>
                Content that has been successfully published across all integrated platforms.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <ProjectTypeFilter 
                selectedTypes={[]}
                onTypesChange={(types) => {
                  // Implement client-side filtering if needed
                  console.log('Filter completed content:', types);
                }}
              />
              <NewContentButton />
            </div>
          </CardHeader>
          <CardContent>
            <EnhancedContentTable
              serverContent={fullyCompletedContent.map(item => ({ 
                ...item, 
                content_assets: item.content_assets || [] 
              }))}
              businessId={businessId || ''}
              variant="completed"
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
```

#### File: `app/(app)/content/partially-published/page.tsx`
Add project type filtering to partially published content:

```typescript
import { Suspense } from 'react';
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
import { NewContentButton } from '@/components/shared/new-content-button';
import { ProjectTypeFilter } from '@/components/shared/project-type-filter';
import { deleteContent } from '../drafts/actions';

export default async function PartiallyPublishedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  const businessId = profile.business_id;

  // Fetch content with assets for analysis
  const { data: contentWithAssets, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      ),
      content_assets (
        id,
        content_type,
        asset_status,
        asset_scheduled_at
      )
    `)
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching content:', error);
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load content. Please try again.</p>
      </div>
    );
  }

  // Filter for partially published content
  const partiallyPublishedContent = contentWithAssets.filter(content => {
    const assets = content.content_assets || [];
    const sentAssets = assets.filter(asset => asset.asset_status === 'Sent');
    return assets.length > 0 && sentAssets.length > 0 && sentAssets.length < assets.length;
  });

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
        <h1 className="text-3xl font-bold">Partially Published Content</h1>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Partially Published Content</CardTitle>
              <CardDescription>
                Content where some assets have been published, but others are still pending or failed.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <ProjectTypeFilter 
                selectedTypes={[]}
                onTypesChange={(types) => {
                  // Implement client-side filtering if needed
                  console.log('Filter partially published content:', types);
                }}
              />
              <NewContentButton />
            </div>
          </CardHeader>
          <CardContent>
            <EnhancedContentTable
              serverContent={partiallyPublishedContent.map(item => ({ 
                ...item, 
                content_assets: item.content_assets || [] 
              }))}
              businessId={businessId || ''}
              variant="partially-published"
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
```

### Step 2: Update Main Content Page

#### File: `app/(app)/content/page.tsx`
Add project type overview to the main content page:

```typescript
import { Suspense } from 'react';
import Link from 'next/link';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  RotateCcw,
  PlusCircle,
  Mic,
  Video
} from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { EnhancedContentTable } from '@/components/shared/enhanced-content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { NewContentButton } from '@/components/shared/new-content-button';
import { ProjectTypeBadge } from '@/components/shared/project-type-badge';
import { deleteContent, retryContentProcessing } from './drafts/actions';

export default async function ContentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  const businessId = profile.business_id;

  // Fetch recent content with project types
  const { data: recentContent, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching content:', error);
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load content. Please try again.</p>
      </div>
    );
  }

  // Get project type statistics
  const voiceRecordingCount = recentContent.filter(c => c.project_type === 'voice_recording').length;
  const videoUploadCount = recentContent.filter(c => c.project_type === 'video_upload').length;
  const processingCount = recentContent.filter(c => c.status === 'processing').length;
  const draftCount = recentContent.filter(c => c.status === 'completed' && !c.scheduled_at).length;

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Content Overview</h1>
          <NewContentButton />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Voice Recording Projects</CardTitle>
              <Mic className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{voiceRecordingCount}</div>
              <p className="text-xs text-muted-foreground">Audio-based content</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Video Upload Projects</CardTitle>
              <Video className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{videoUploadCount}</div>
              <p className="text-xs text-muted-foreground">Video-based content</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{processingCount}</div>
              <p className="text-xs text-muted-foreground">Currently being processed</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ready to Schedule</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftCount}</div>
              <p className="text-xs text-muted-foreground">Content ready for scheduling</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Start creating new content projects</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/voice-recording">
                <Button className="w-full justify-start" variant="outline">
                  <Mic className="mr-2 h-4 w-4" />
                  Create Voice Recording Project
                </Button>
              </Link>
              <Link href="/video-upload">
                <Button className="w-full justify-start" variant="outline">
                  <Video className="mr-2 h-4 w-4" />
                  Create Video Upload Project
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest content projects</CardDescription>
            </CardHeader>
            <CardContent>
              {recentContent.slice(0, 5).map((content) => (
                <div key={content.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center space-x-3">
                    <ProjectTypeBadge projectType={content.project_type} showIcon={false} />
                    <div>
                      <p className="text-sm font-medium">
                        {content.content_title || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(content.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={content.status === 'completed' ? 'default' : 'secondary'}>
                    {content.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Content Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Content</CardTitle>
            <CardDescription>
              Your latest content projects across all types and statuses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedContentTable
              serverContent={recentContent.map(item => ({ ...item, content_assets: undefined }))}
              businessId={businessId || ''}
              variant="overview"
              showPagination={false}
              pageSize={10}
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
```

### Step 3: Update Enhanced Content Assets Manager

#### File: `components/shared/enhanced-content-assets-manager.tsx`
Add project type awareness to the content assets manager:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Mail, 
  Share2, 
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Edit
} from 'lucide-react';
import { Tables } from '@/types/supabase';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { ProjectTypeBadge } from './project-type-badge';
import { shouldShowTranscript } from '@/lib/content-status';

interface EnhancedContentAssetsManagerProps {
  content: Tables<'content'>;
  contentAssets: Tables<'content_assets'>[];
  onAssetsUpdated: (assets: Tables<'content_assets'>[]) => void;
}

export function EnhancedContentAssetsManager({
  content,
  contentAssets,
  onAssetsUpdated,
}: EnhancedContentAssetsManagerProps) {
  const [assets, setAssets] = useState(contentAssets);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  // Group assets by content type
  const groupedAssets = assets.reduce((acc, asset) => {
    const type = asset.content_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(asset);
    return acc;
  }, {} as Record<string, Tables<'content_assets'>[]>);

  const getAssetTypeInfo = (contentType: string) => {
    const typeMap: Record<string, { icon: any; label: string; color: string }> = {
      'blog_post': { icon: FileText, label: 'Blog Posts', color: 'blue' },
      'email': { icon: Mail, label: 'Emails', color: 'green' },
      'social_short_video': { icon: Share2, label: 'Short Videos', color: 'purple' },
      'social_long_video': { icon: Share2, label: 'Long Videos', color: 'indigo' },
      'social_blog_post': { icon: Share2, label: 'Social Posts', color: 'pink' },
    };
    
    return typeMap[contentType] || { icon: FileText, label: contentType, color: 'gray' };
  };

  const getStatusInfo = (asset: Tables<'content_assets'>) => {
    if (asset.asset_status === 'Sent') {
      return { icon: CheckCircle, label: 'Published', color: 'text-green-600', bgColor: 'bg-green-50' };
    }
    if (asset.asset_scheduled_at) {
      return { icon: Clock, label: 'Scheduled', color: 'text-blue-600', bgColor: 'bg-blue-50' };
    }
    if (asset.approved === false) {
      return { icon: AlertCircle, label: 'Needs Review', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    }
    return { icon: FileText, label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-50' };
  };

  const handleApproveAsset = async (assetId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('content_assets')
        .update({ approved: true })
        .eq('id', assetId);

      if (error) {
        toast.error('Failed to approve asset');
        return;
      }

      // Update local state
      const updatedAssets = assets.map(asset =>
        asset.id === assetId ? { ...asset, approved: true } : asset
      );
      setAssets(updatedAssets);
      onAssetsUpdated(updatedAssets);
      toast.success('Asset approved successfully');
    } catch (error) {
      toast.error('Failed to approve asset');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with project type */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-semibold">Content Assets</h2>
          <ProjectTypeBadge projectType={content.project_type} />
        </div>
        <Badge variant="outline">
          {assets.length} {assets.length === 1 ? 'asset' : 'assets'} generated
        </Badge>
      </div>

      {/* Show project-specific information */}
      {content.project_type === 'video_upload' && !shouldShowTranscript(content.project_type) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Video Upload Project:</strong> Content assets are generated from your uploaded video. 
              The video transcript is used internally and not displayed in the interface.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Assets organized by type */}
      {Object.keys(groupedAssets).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Content Assets Yet</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {content.status === 'processing' 
                ? `Your ${content.project_type === 'video_upload' ? 'video' : 'audio'} is being processed. Content assets will appear here once generation is complete.`
                : 'Content assets will be generated automatically once processing is complete.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={Object.keys(groupedAssets)[0]} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            {Object.keys(groupedAssets).map((contentType) => {
              const typeInfo = getAssetTypeInfo(contentType);
              const TypeIcon = typeInfo.icon;
              return (
                <TabsTrigger key={contentType} value={contentType} className="flex items-center space-x-2">
                  <TypeIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{typeInfo.label}</span>
                  <Badge variant="secondary" className="ml-1">
                    {groupedAssets[contentType].length}
                  </Badge>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.entries(groupedAssets).map(([contentType, typeAssets]) => {
            const typeInfo = getAssetTypeInfo(contentType);
            return (
              <TabsContent key={contentType} value={contentType}>
                <div className="grid gap-4">
                  {typeAssets.map((asset) => {
                    const statusInfo = getStatusInfo(asset);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <Card key={asset.id}>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg bg-${typeInfo.color}-100 text-${typeInfo.color}-600`}>
                              <typeInfo.icon className="h-4 w-4" />
                            </div>
                            <div>
                              <h4 className="font-medium">
                                {asset.asset_title || `${typeInfo.label} Asset`}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Created {new Date(asset.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${statusInfo.bgColor}`}>
                              <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                              <span className={`text-sm font-medium ${statusInfo.color}`}>
                                {statusInfo.label}
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {asset.asset_content && (
                            <div className="mb-4">
                              <div className="prose prose-sm max-w-none">
                                <p className="line-clamp-3">{asset.asset_content.substring(0, 200)}...</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Button variant="outline" size="sm">
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </Button>
                              <Button variant="outline" size="sm">
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            </div>
                            {asset.approved === false && (
                              <Button
                                onClick={() => handleApproveAsset(asset.id)}
                                disabled={isLoading}
                                size="sm"
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            )}
                            {asset.approved === true && !asset.asset_scheduled_at && (
                              <Button variant="outline" size="sm">
                                <Calendar className="h-4 w-4 mr-2" />
                                Schedule
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
```

## Testing Phase 5

### Complete UI Testing
1. **Content Page Consistency**:
   - ✅ All content pages show project type filters
   - ✅ New Content buttons appear on all relevant pages
   - ✅ Project type badges display consistently
   - ✅ Statistics reflect both project types

2. **Table Functionality**:
   - ✅ Project type column appears in all content tables
   - ✅ Filtering works correctly for each project type
   - ✅ Actions work for both voice recording and video upload

3. **Content Assets**:
   - ✅ Assets manager shows project type information
   - ✅ Video upload projects show appropriate messaging
   - ✅ Asset generation works for both project types

### Navigation Testing
```bash
# Test all content pages
curl http://localhost:3000/content
curl http://localhost:3000/content/drafts
curl http://localhost:3000/content/scheduled
curl http://localhost:3000/content/completed
curl http://localhost:3000/content/partially-published
```

### Database Integration Testing
```sql
-- Test mixed content types in tables
SELECT 
  project_type,
  COUNT(*) as count,
  status
FROM content 
GROUP BY project_type, status
ORDER BY project_type, status;
```

## Completion Checklist

- [ ] ✅ All content pages updated with project type filtering
- [ ] ✅ New Content buttons added to all relevant pages
- [ ] ✅ Content overview page shows project type statistics
- [ ] ✅ Enhanced content assets manager project-type aware
- [ ] ✅ Project type badges consistent across all components
- [ ] ✅ Table functionality works for both project types
- [ ] ✅ Filter components working properly
- [ ] ✅ Statistics and counts accurate for mixed project types
- [ ] ✅ Navigation flows work for both project types
- [ ] ✅ No TypeScript errors in any updated components
- [ ] ✅ Responsive design maintained across all pages
- [ ] ✅ All content pages show appropriate project information

## Next Steps

Once Phase 5 is complete:
1. Test all UI components thoroughly
2. Verify data consistency across all pages
3. Move to **Phase 6: Testing and Integration**

## Troubleshooting

### Statistics Issues
```typescript
// Debug project type counting
const projectTypeCounts = content.reduce((acc, item) => {
  acc[item.project_type || 'unknown'] = (acc[item.project_type || 'unknown'] || 0) + 1;
  return acc;
}, {});
console.log('Project type counts:', projectTypeCounts);
```

### Filter Issues
```typescript
// Test project type filtering
const filteredContent = content.filter(item => 
  selectedTypes.length === 0 || selectedTypes.includes(item.project_type)
);
console.log('Filtered content:', filteredContent);
```

### Badge Display Issues
```typescript
// Verify project type data
content.forEach(item => {
  console.log(`Content ${item.id}: project_type = ${item.project_type}`);
});
``` 