# Video Upload Project - Phase 4: Content Display Updates

## Overview
This phase updates the content details page and related components to properly display project types, hide transcript for video uploads, and integrate the new project type badge system. Complete Phases 1-3 before starting this phase.

## Implementation Steps

### Step 1: Update Content Details Page

#### File: `components/shared/content-client-page.tsx`
Update to show project type and conditionally hide transcript:

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  RotateCcw,
  Settings,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { Tables } from '@/types/supabase';
import { toast } from 'sonner';
import { ContentAssetsManager } from './content-assets-manager';
import { ContentEditModal } from './content-edit-modal';
import { AudioPlayer } from './audio-player';
import { VideoPlayer } from './video-player';
import { ProjectTypeBadge } from './project-type-badge';
import { shouldShowTranscript, getProcessingLabel } from '@/lib/content-status';
import { retryVideoTranscription } from '@/lib/retry-actions';

type ContentWithBusiness = Tables<'content'> & {
  businesses: (Tables<'businesses'> & {
    ai_avatar_integrations: Tables<'ai_avatar_integrations'>[];
  }) | null;
};

interface ContentClientPageProps {
  initialContent: ContentWithBusiness;
  contentAssets: Tables<'content_assets'>[];
}

export function ContentClientPage({
  initialContent,
  contentAssets: initialContentAssets,
}: ContentClientPageProps) {
  const [content, setContent] = useState(initialContent);
  const [contentAssets, setContentAssets] = useState(initialContentAssets);
  const [isRetrying, setIsRetrying] = useState(false);
  const router = useRouter();

  const handleRetry = useCallback(async () => {
    if (!content.id) return;
    
    setIsRetrying(true);
    try {
      const result = await retryVideoTranscription(content.id);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Processing retry started successfully');
        // Optimistically update the status
        setContent(prev => ({
          ...prev,
          status: 'processing',
          content_generation_status: null,
        }));
      }
    } catch (error) {
      console.error('Error retrying processing:', error);
      toast.error('Failed to retry processing');
    } finally {
      setIsRetrying(false);
    }
  }, [content.id]);

  const getStatusInfo = () => {
    const status = content.status;
    const generationStatus = content.content_generation_status;
    
    if (status === 'processing' || generationStatus === 'generating') {
      return {
        icon: Clock,
        label: getProcessingLabel(content.project_type),
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
      };
    }
    
    if (status === 'failed' || generationStatus === 'failed') {
      return {
        icon: AlertCircle,
        label: 'Processing Failed',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        showRetry: true,
      };
    }
    
    if (status === 'completed') {
      return {
        icon: CheckCircle,
        label: 'Content Ready',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
      };
    }
    
    return {
      icon: FileText,
      label: 'Draft',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const showTranscript = shouldShowTranscript(content.project_type);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {content.content_title || 'Untitled Content'}
            </h1>
            {/* Project Type Badge */}
            <div className="flex items-center gap-2 mt-2">
              <ProjectTypeBadge projectType={content.project_type} />
              <Separator orientation="vertical" className="h-4" />
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor}`}>
                <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                <span className={`text-sm font-medium ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
                {statusInfo.showRetry && (
                  <>
                    <Separator orientation="vertical" className="h-4" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="h-6 px-2 py-0 text-xs"
                    >
                      <RotateCcw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                      {isRetrying ? 'Retrying...' : 'Retry'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <ContentEditModal
            content={content}
            onContentUpdated={(updatedContent) => setContent(updatedContent)}
          />
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule
          </Button>
        </div>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assets">Content Assets</TabsTrigger>
          {showTranscript && <TabsTrigger value="transcript">Transcript</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Media Player */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>
                    {content.project_type === 'video_upload' ? 'Source Video' : 'Source Audio'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {content.project_type === 'video_upload' && content.video_long_url ? (
                  <VideoPlayer
                    src={content.video_long_url}
                    className="w-full rounded-lg"
                  />
                ) : content.audio_url ? (
                  <AudioPlayer
                    src={content.audio_url}
                    className="w-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-32 bg-muted rounded-lg">
                    <p className="text-muted-foreground text-sm">
                      {content.status === 'processing' 
                        ? getProcessingLabel(content.project_type)
                        : 'No media available'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Content Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Content Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Project Type:</span>
                    <div className="mt-1">
                      <ProjectTypeBadge projectType={content.project_type} showIcon />
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">
                      <Badge variant="outline">{statusInfo.label}</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="mt-1">
                      {new Date(content.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assets:</span>
                    <p className="mt-1">{contentAssets.length} generated</p>
                  </div>
                </div>

                {content.video_script && (
                  <div>
                    <span className="text-muted-foreground text-sm">Video Script Preview:</span>
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <p className="text-sm line-clamp-3">
                        {content.video_script.substring(0, 200)}...
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets">
          <ContentAssetsManager
            content={content}
            contentAssets={contentAssets}
            onAssetsUpdated={setContentAssets}
          />
        </TabsContent>

        {/* Only show transcript tab for voice recording projects */}
        {showTranscript && (
          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {content.transcript ? (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap">{content.transcript}</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-muted-foreground">
                      {content.status === 'processing' 
                        ? 'Transcript is being generated...'
                        : 'No transcript available'
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Content Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Content settings and configuration options will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 2: Update Enhanced Content Table

#### File: `components/shared/enhanced-content-table.tsx`
Add project type column and status handling:

```typescript
// Add import for the new badge component
import { ProjectTypeBadge } from './project-type-badge';
import { shouldShowTranscript } from '@/lib/content-status';

// In the columns definition, add project type column after the title column:

{
  accessorKey: 'project_type',
  header: 'Type',
  cell: ({ row }) => {
    const projectType = row.getValue('project_type') as string | null;
    return <ProjectTypeBadge projectType={projectType} showIcon={false} />;
  },
},

// Update the status cell to use the proper status logic:

{
  accessorKey: 'status',
  header: 'Status',
  cell: ({ row }) => {
    const content = row.original;
    const status = determineContentStatus(content, content.content_assets || []);
    
    return (
      <div className="flex items-center space-x-2">
        <StatusBadge status={status} />
        {status === 'failed' && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(content.id);
            }}
            className="h-6 px-2 py-0 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  },
},

// Update the ActionCell to handle project-specific actions:

function ActionCell({ content, onDelete, onRetry }: ActionCellProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const status = determineContentStatus(content, content.content_assets || []);
  const showTranscript = shouldShowTranscript(content.project_type);

  return (
    <div className="flex items-center justify-end space-x-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/content/${content.id}`}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Link>
          </DropdownMenuItem>
          
          {status === 'failed' && onRetry && (
            <DropdownMenuItem onClick={() => onRetry(content.id)}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry Processing
            </DropdownMenuItem>
          )}
          
          {showTranscript && content.transcript && (
            <DropdownMenuItem asChild>
              <Link href={`/content/${content.id}?tab=transcript`}>
                <FileText className="mr-2 h-4 w-4" />
                View Transcript
              </Link>
            </DropdownMenuItem>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this {content.project_type === 'video_upload' ? 'video upload' : 'voice recording'} project and all associated content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete?.(content.id);
                setShowDeleteDialog(false);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

### Step 3: Update Content Status Flow Component

#### File: `components/shared/content-status-flow.tsx`
Update to handle both project types:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RotateCcw,
  Mic,
  Video,
  FileText,
  Zap
} from 'lucide-react';
import { Tables } from '@/types/supabase';
import { getProcessingLabel, shouldShowTranscript } from '@/lib/content-status';
import { ProjectTypeBadge } from './project-type-badge';

interface ContentStatusFlowProps {
  content: Tables<'content'>;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ContentStatusFlow({ content, onRetry, isRetrying }: ContentStatusFlowProps) {
  const showTranscript = shouldShowTranscript(content.project_type);
  
  // Define the workflow steps based on project type
  const getWorkflowSteps = () => {
    const baseSteps = [
      {
        id: 'upload',
        title: content.project_type === 'video_upload' ? 'Video Upload' : 'Audio Recording',
        icon: content.project_type === 'video_upload' ? Video : Mic,
        completed: !!(content.video_long_url || content.audio_url),
      },
      {
        id: 'transcription',
        title: content.project_type === 'video_upload' ? 'Video Transcription' : 'Audio Transcription',
        icon: FileText,
        completed: !!content.transcript,
        processing: content.status === 'processing' && !content.transcript,
        failed: content.status === 'failed' && !content.transcript,
      },
      {
        id: 'generation',
        title: 'Content Generation',
        icon: Zap,
        completed: content.content_generation_status === 'completed',
        processing: content.content_generation_status === 'generating',
        failed: content.content_generation_status === 'failed',
      },
    ];

    return baseSteps;
  };

  const steps = getWorkflowSteps();
  const hasFailedStep = steps.some(step => step.failed);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center space-x-2">
            <span>Processing Status</span>
            <ProjectTypeBadge projectType={content.project_type} />
          </CardTitle>
        </div>
        {hasFailedStep && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={isRetrying}
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry Processing'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            
            return (
              <div key={step.id} className="flex items-center space-x-4">
                <div className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                  ${step.completed 
                    ? 'bg-green-100 border-green-500 text-green-700' 
                    : step.failed
                    ? 'bg-red-100 border-red-500 text-red-700'
                    : step.processing
                    ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                  }
                `}>
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : step.failed ? (
                    <AlertCircle className="h-4 w-4" />
                  ) : step.processing ? (
                    <Clock className="h-4 w-4 animate-pulse" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-medium ${
                      step.completed ? 'text-green-700' : 
                      step.failed ? 'text-red-700' :
                      step.processing ? 'text-yellow-700' : 
                      'text-gray-700'
                    }`}>
                      {step.title}
                    </h4>
                    
                    <Badge variant={
                      step.completed ? 'default' : 
                      step.failed ? 'destructive' :
                      step.processing ? 'secondary' : 
                      'outline'
                    }>
                      {step.completed ? 'Completed' : 
                       step.failed ? 'Failed' :
                       step.processing ? 'Processing' : 
                       'Pending'}
                    </Badge>
                  </div>
                  
                  {step.processing && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {getProcessingLabel(content.project_type)}
                    </p>
                  )}
                  
                  {step.failed && (
                    <p className="text-sm text-red-600 mt-1">
                      Processing failed. Click retry to try again.
                    </p>
                  )}
                </div>
                
                {/* Connection line to next step */}
                {index < steps.length - 1 && (
                  <div className="absolute left-[15px] mt-8 w-0.5 h-4 bg-gray-300" />
                )}
              </div>
            );
          })}
        </div>

        {/* Additional info for video projects */}
        {content.project_type === 'video_upload' && !showTranscript && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              💡 <strong>Note:</strong> Video upload projects don't show transcripts in the UI. 
              The transcript is generated and used internally for content creation.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Step 4: Create Project Type Filter Component

#### File: `components/shared/project-type-filter.tsx`
Create filter component for content tables:

```typescript
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Filter, Mic, Video } from 'lucide-react';
import { PROJECT_TYPES, PROJECT_TYPE_LABELS } from '@/types';

interface ProjectTypeFilterProps {
  selectedTypes: string[];
  onTypesChange: (types: string[]) => void;
}

export function ProjectTypeFilter({ selectedTypes, onTypesChange }: ProjectTypeFilterProps) {
  const handleTypeToggle = (type: string) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const isAllSelected = selectedTypes.length === 0;
  const selectedCount = selectedTypes.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <Filter className="mr-2 h-4 w-4" />
          Project Type
          {selectedCount > 0 && (
            <>
              <div className="mx-2 h-4 w-px bg-muted-foreground/50" />
              <span className="rounded-sm bg-muted px-1 text-xs">
                {selectedCount}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Filter by Project Type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuCheckboxItem
          checked={isAllSelected}
          onCheckedChange={() => onTypesChange([])}
        >
          All Projects
        </DropdownMenuCheckboxItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuCheckboxItem
          checked={selectedTypes.includes(PROJECT_TYPES.VOICE_RECORDING)}
          onCheckedChange={() => handleTypeToggle(PROJECT_TYPES.VOICE_RECORDING)}
        >
          <Mic className="mr-2 h-4 w-4" />
          {PROJECT_TYPE_LABELS.voice_recording}
        </DropdownMenuCheckboxItem>
        
        <DropdownMenuCheckboxItem
          checked={selectedTypes.includes(PROJECT_TYPES.VIDEO_UPLOAD)}
          onCheckedChange={() => handleTypeToggle(PROJECT_TYPES.VIDEO_UPLOAD)}
        >
          <Video className="mr-2 h-4 w-4" />
          {PROJECT_TYPE_LABELS.video_upload}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 5: Update Content Pages with Project Type Filter

#### File: `app/(app)/content/drafts/page.tsx`
Add project type filtering to the drafts page:

```typescript
// Add import for project type filter
import { ProjectTypeFilter } from '@/components/shared/project-type-filter';

// In the page component, add the filter to the CardHeader:

<CardHeader className="flex flex-row items-center justify-between">
  <div>
    <CardTitle>Draft Content</CardTitle>
    <CardDescription>
      Review and approve your content before scheduling. Processing and failed content also appears here.
    </CardDescription>
  </div>
  <div className="flex items-center space-x-2">
    {/* Add Project Type Filter */}
    <ProjectTypeFilter 
      selectedTypes={[]} // Initialize with no filters
      onTypesChange={(types) => {
        // Implement filtering logic or pass to table component
        console.log('Filter changed:', types);
      }}
    />
    <NewContentButton />
  </div>
</CardHeader>
```

## Testing Phase 4

### Content Display Testing
1. **Project Type Display**:
   - ✅ Voice recording projects show "Voice Recording" badge
   - ✅ Video upload projects show "Video Upload" badge
   - ✅ Icons display correctly for each type

2. **Transcript Hiding**:
   - ✅ Voice recording projects show transcript tab and content
   - ✅ Video upload projects hide transcript tab completely
   - ✅ No transcript-related UI elements for video projects

3. **Status Flow**:
   - ✅ Processing states show correct labels for each project type
   - ✅ Retry functionality works for both project types
   - ✅ Status badges update correctly

### Table Testing
```bash
# Test content table with mixed project types
curl http://localhost:3000/api/test-content-table
```

### UI Consistency Testing
1. **Badge Consistency**:
   - Same badge design across all components
   - Proper icons for each project type
   - Consistent colors and styling

2. **Responsive Design**:
   - Project type badges work on mobile
   - Tables scroll properly with new column
   - Filter component works on small screens

## Completion Checklist

- [ ] ✅ Content details page updated with project type display
- [ ] ✅ Transcript section hidden for video upload projects
- [ ] ✅ Enhanced content table includes project type column
- [ ] ✅ Content status flow updated for both project types
- [ ] ✅ Project type filter component created
- [ ] ✅ Project type badge component working consistently
- [ ] ✅ Retry functionality works for both project types
- [ ] ✅ Status labels reflect project type correctly
- [ ] ✅ All UI components show proper project type information
- [ ] ✅ No TypeScript errors in updated components
- [ ] ✅ Responsive design maintained across all screen sizes

## Next Steps

Once Phase 4 is complete:
1. Test all content display functionality thoroughly
2. Verify project type filtering works correctly
3. Move to **Phase 5: Table and UI Finalization**

## Troubleshooting

### Badge Display Issues
```typescript
// Check if project type is being passed correctly
console.log('Project type:', content.project_type);

// Verify badge component receives correct props
<ProjectTypeBadge projectType={content.project_type} showIcon />
```

### Transcript Hiding Issues
```typescript
// Test the shouldShowTranscript function
import { shouldShowTranscript } from '@/lib/content-status';
console.log('Show transcript:', shouldShowTranscript(projectType));
```

### Table Column Issues
```sql
-- Verify project_type data in database
SELECT id, project_type, content_title, status 
FROM content 
WHERE project_type IS NOT NULL 
ORDER BY created_at DESC;