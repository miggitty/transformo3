# Video Upload Project - Phase 2: Navigation & Routing

## Overview
This phase implements the new navigation system with "New Content" button dropdowns and updates routing structure. Complete Phase 1 before starting this phase.

## Implementation Steps

### Step 1: Create New Content Button Component

#### File: `components/shared/new-content-button.tsx`
Create reusable button component with dropdown menu:

```typescript
'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, ChevronDown, Mic, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PROJECT_TYPES } from '@/types';

interface NewContentButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function NewContentButton({ 
  variant = 'default',
  size = 'default',
  className 
}: NewContentButtonProps) {
  const router = useRouter();

  const handleVoiceRecording = () => {
    router.push('/voice-recording');
  };

  const handleVideoUpload = () => {
    router.push('/video-upload');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={className}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          New Content
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleVoiceRecording}>
          <Mic className="mr-2 h-4 w-4" />
          Voice Recording
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleVideoUpload}>
          <Video className="mr-2 h-4 w-4" />
          Video Upload
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 2: Update Sidebar Navigation

#### File: `components/shared/sidebar-nav.tsx`
**SIMPLE APPROACH**: Just replace the existing "New Content" link with the dropdown button:

**MINIMAL CHANGE APPROACH**: Only modify what's needed in the existing component:

```typescript
// 1. Add import at the top of the existing file
import { NewContentButton } from './new-content-button';

// 2. Remove or comment out the existing navigationItems array:
// const navigationItems = [
//   {
//     href: '/new',
//     label: 'New Content',
//     icon: PlusCircle,
//   },
// ];

// 3. In the existing JSX, replace the navigationItems.map() section with:
{/* Replace this existing block:
{navigationItems.map((item) => {
  const Icon = item.icon;
  const isActive = pathname === item.href;
  
  return (
    <Link key={item.href} href={item.href} className="...">
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
})}
*/}

{/* With this: */}
<div className="py-2">
  <NewContentButton 
    variant="outline" 
    className="w-full justify-start"
  />
</div>

// 4. Keep ALL other existing code unchanged
```
```

### Step 3: Rename and Update Voice Recording Route

#### Rename Directory
```bash
# Rename the directory
mv app/(app)/new app/(app)/voice-recording
```

#### File: `app/(app)/voice-recording/page.tsx`
Update to include project type assignment:

```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AudioRecorder } from '@/components/shared/audio-recorder';
import { AccessGate } from '@/components/shared/access-gate';

export default function VoiceRecordingPage() {
  return (
    <AccessGate 
      feature="content creation"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content creation requires an active subscription.
          </p>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Create Voice Recording Project</CardTitle>
          <CardDescription>
            Record an audio clip to start the content creation process. Your voice will be transcribed and used to generate content across multiple platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AudioRecorder />
        </CardContent>
      </Card>
    </AccessGate>
  );
}
```

#### File: `app/(app)/voice-recording/actions.ts`
**CRITICAL**: Copy existing `/new/actions.ts` EXACTLY - NO changes to original file. Only add project_type field to the copy:

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { PROJECT_TYPES } from '@/types';
import { revalidatePath } from 'next/cache';

export async function createContentRecord() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to create content.' };
  }

  // Get user's business_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.business_id) {
    return { error: 'Business profile not found.' };
  }

  // Create content record with voice_recording project type
  const { data, error } = await supabase
    .from('content')
    .insert({
      business_id: profile.business_id,
      content_title: `New Recording - ${new Date().toISOString()}`, // Keep existing logic
      status: 'creating', // Keep existing status
      project_type: PROJECT_TYPES.VOICE_RECORDING, // ADD THIS LINE
    })
    .select('id, business_id') // Keep existing select
    .single();

  if (error) {
    console.error('Error creating content record:', error);
    return { error: 'Failed to create content record.' };
  }

  return { data };
}

export async function finalizeContentRecord(
  contentId: string,
  audioUrl: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to finalize content.' };
  }

  // Update content record with audio URL
  const { data: updatedContent, error: updateError } = await supabase
    .from('content')
    .update({ 
      audio_url: audioUrl,
      status: 'processing' // Keep as processing until N8N callback
    })
    .eq('id', contentId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating content record:', updateError);
    return { error: 'Failed to update content record.' };
  }

  // Get external audio URL for N8N (if in development)
  let publicAudioUrl = audioUrl;
  if (process.env.NODE_ENV === 'development' && audioUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
    const urlPath = audioUrl.replace('http://127.0.0.1:54321', '');
    publicAudioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
  }

  // Trigger N8N audio processing workflow
  const webhookUrl = process.env.N8N_WEBHOOK_URL_AUDIO_PROCESSING;
  
  console.log('=== N8N Environment Variables Debug ===');
  console.log('N8N_WEBHOOK_URL_AUDIO_PROCESSING:', webhookUrl);
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('N8N_CALLBACK_SECRET exists:', !!process.env.N8N_CALLBACK_SECRET);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  if (!webhookUrl) {
    console.error('N8N_WEBHOOK_URL_AUDIO_PROCESSING is not configured');
    return { error: 'Audio processing webhook not configured' };
  }

  try {
    // Use existing payload structure and add project type
    const enrichedPayload = {
      audio_url: publicAudioUrl,
      content_id: updatedContent.id,
      business_id: updatedContent.business_id!,
      project_type: PROJECT_TYPES.VOICE_RECORDING, // ADD THIS LINE to existing payload
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV
    };

    console.log('Triggering N8N audio processing workflow...');
    console.log('N8N Payload being sent:', JSON.stringify(enrichedPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    console.log('N8N webhook response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook failed:', errorText);
      return { error: `N8N webhook failed: ${response.statusText}` };
    }

    console.log('N8N webhook response: Success');

    revalidatePath('/content');
    revalidatePath(`/content/${contentId}`);

    return { data: { message: 'Content finalized successfully' } };
  } catch (error) {
    console.error('Error triggering N8N workflow:', error);
    return { error: 'Failed to trigger audio processing workflow' };
  }
}
```

### Step 4: Create Video Upload Route Structure

#### Create Directory
```bash
mkdir -p app/(app)/video-upload
```

#### File: `app/(app)/video-upload/page.tsx`
Create the video upload page:

```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { VideoUploadClient } from './video-upload-client';
import { AccessGate } from '@/components/shared/access-gate';

export default function VideoUploadPage() {
  return (
    <AccessGate 
      feature="content creation"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content creation requires an active subscription.
          </p>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Create Video Upload Project</CardTitle>
          <CardDescription>
            Upload a video file to start the content creation process. Your video will be transcribed and used to generate content across multiple platforms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUploadClient />
        </CardContent>
      </Card>
    </AccessGate>
  );
}
```

#### File: `app/(app)/video-upload/video-upload-client.tsx`
**SIMPLE CLIENT COMPONENT**: Reuse existing VideoUploadModal pattern:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { VideoUploadModal } from '@/components/shared/video-upload-modal';
import { Upload, Video } from 'lucide-react';
import { toast } from 'sonner';
import { createVideoUploadProject } from './actions';

export function VideoUploadClient() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const router = useRouter();

  const handleStartUpload = async () => {
    setIsCreating(true);
    
    try {
      const result = await createVideoUploadProject();
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.data) {
        setContentId(result.data.id);
        setBusinessId(result.data.business_id);
        setUploadModalOpen(true);
      }
    } catch (error) {
      console.error('Error creating video upload project:', error);
      toast.error('Failed to start video upload project');
    } finally {
      setIsCreating(false);
    }
  };

  const handleVideoUploaded = (videoType: 'long' | 'short', videoUrl: string) => {
    toast.success('Video uploaded successfully!');
    setUploadModalOpen(false);
    
    // Navigate to drafts page to see the processing content
    router.push('/content/drafts');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Video className="h-16 w-16 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Upload Your Video</h3>
          <p className="text-muted-foreground max-w-md">
            Upload a video file (MP4, WebM, or MOV) up to 400MB. We'll transcribe your video and generate content across multiple platforms.
          </p>
        </div>
        <Button 
          onClick={handleStartUpload}
          disabled={isCreating}
          size="lg"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isCreating ? 'Preparing Upload...' : 'Start Video Upload'}
        </Button>
      </div>

      {/* Video Upload Modal */}
      {contentId && businessId && (
        <VideoUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          videoType="long" // We'll use long video for the main upload
          contentId={contentId}
          businessId={businessId}
          onVideoUploaded={handleVideoUploaded}
        />
      )}
    </div>
  );
}
```

#### File: `app/(app)/video-upload/actions.ts`
Create server actions for video upload project:

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { PROJECT_TYPES } from '@/types';
import { revalidatePath } from 'next/cache';

export async function createVideoUploadProject() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to create content.' };
  }

  // Get user's business_id
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.business_id) {
    return { error: 'Business profile not found.' };
  }

  // Create content record with video_upload project type
  const { data, error } = await supabase
    .from('content')
    .insert({
      business_id: profile.business_id,
      status: 'processing',
      project_type: PROJECT_TYPES.VIDEO_UPLOAD, // Set project type
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating content record:', error);
    return { error: 'Failed to create content record.' };
  }

  return { data };
}

export async function finalizeVideoUploadRecord(
  contentId: string,
  videoUrl: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to finalize content.' };
  }

  // Update content record with video URL
  const { data: updatedContent, error: updateError } = await supabase
    .from('content')
    .update({ 
      video_long_url: videoUrl,
      status: 'processing' // Keep as processing until N8N callback
    })
    .eq('id', contentId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating content record:', updateError);
    return { error: 'Failed to update content record.' };
  }

  // Get external video URL for N8N (if in development)
  let publicVideoUrl = videoUrl;
  if (process.env.NODE_ENV === 'development' && videoUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
    const urlPath = videoUrl.replace('http://127.0.0.1:54321', '');
    publicVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
  }

  // Trigger N8N video transcription workflow
  const webhookUrl = process.env.N8N_WEBHOOK_VIDEO_TRANSCRIPTION;
  
  console.log('=== N8N Video Transcription Debug ===');
  console.log('N8N_WEBHOOK_VIDEO_TRANSCRIPTION:', webhookUrl);
  console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
  console.log('N8N_CALLBACK_SECRET exists:', !!process.env.N8N_CALLBACK_SECRET);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  if (!webhookUrl) {
    console.error('N8N_WEBHOOK_VIDEO_TRANSCRIPTION is not configured');
    return { error: 'Video transcription webhook not configured' };
  }

  try {
    // Add environment-specific callback information
    const enrichedPayload = {
      video_url: publicVideoUrl,
      content_id: updatedContent.id,
      business_id: updatedContent.business_id!,
      project_type: PROJECT_TYPES.VIDEO_UPLOAD, // Include project type
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV
    };

    console.log('Triggering N8N video transcription workflow...');
    console.log('N8N Payload being sent:', JSON.stringify(enrichedPayload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });

    console.log('N8N webhook response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook failed:', errorText);
      return { error: `N8N webhook failed: ${response.statusText}` };
    }

    console.log('N8N webhook response: Success');

    revalidatePath('/content');
    revalidatePath(`/content/${contentId}`);

    return { data: { message: 'Video upload finalized successfully' } };
  } catch (error) {
    console.error('Error triggering N8N workflow:', error);
    return { error: 'Failed to trigger video transcription workflow' };
  }
}
```

### Step 5: Update Drafts Page Header

#### File: `app/(app)/content/drafts/page.tsx`
Replace the old "New Content" button with the dropdown:

```typescript
import { Suspense } from 'react';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
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
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { NewContentButton } from '@/components/shared/new-content-button'; // Import the new component
import { deleteContent, retryContentProcessing } from './actions';

export default async function DraftsPage() {
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

  // Fetch draft content (including failed content)
  const { data: draftContent, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      )
    `)
    .eq('business_id', businessId)
    .in('status', ['processing', 'failed', 'completed'])
    .is('scheduled_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching draft content:', error);
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
        <Suspense fallback={null}>
          <TrialSuccessBanner />
        </Suspense>
        
        <h1 className="text-3xl font-bold">Content Drafts</h1>
        
        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Draft Content</CardTitle>
            <CardDescription>
              Review and approve your content before scheduling. Processing and failed content also appears here.
            </CardDescription>
          </div>
          {/* Replace the old Link with NewContentButton */}
          <NewContentButton />
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
      </div>
    </AccessGate>
  );
}
```

### Step 6: Update Video Upload Modal Integration

#### File: `components/shared/video-upload-modal.tsx`
Add integration with the finalize action for video upload projects:

```typescript
// Add this import at the top
import { finalizeVideoUploadRecord } from '@/app/(app)/video-upload/actions';

// Update the handleUpload function to check if this is a video upload project
// and call the appropriate finalize function

// In the existing VideoUploadModal component, add this after successful upload:

const handleUpload = async () => {
  if (!selectedFile) {
    toast.error('Please select a video file to upload');
    return;
  }

  setIsUploading(true);
  setUploadProgress(0);

  try {
    const fileExtension = getFileExtension(selectedFile);
    const fileName = `${businessId}_${contentId}_video_upload.${fileExtension}`;

    // Existing upload logic...
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(fileName, selectedFile, {
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      toast.error(`Unable to save video: ${uploadError.message || 'Please try again.'}`);
      return;
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('videos')
      .getPublicUrl(fileName);

    let publicUrl = publicUrlData.publicUrl;

    // Development URL conversion for external services
    if (process.env.NODE_ENV === 'development' && publicUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
      const urlPath = publicUrl.replace('http://127.0.0.1:54321', '');
      publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
    }

    // Update the content record using server action
    const { success, error: updateError } = await updateVideoUrl({
      contentId,
      videoType,
      videoUrl: publicUrl,
    });

    if (!success) {
      toast.error(updateError || 'Video uploaded but failed to save. Please contact support.');
      return;
    }

    // If this is a video upload project (videoType === 'long' and this is the main upload)
    // trigger the video transcription workflow
    if (videoType === 'long') {
      try {
        const finalizeResult = await finalizeVideoUploadRecord(contentId, publicUrl);
        if (finalizeResult.error) {
          console.error('Failed to trigger video transcription:', finalizeResult.error);
          // Don't show error to user as the video was uploaded successfully
          // The transcription can be retried later
        }
      } catch (error) {
        console.error('Error triggering video transcription:', error);
        // Don't show error to user as the video was uploaded successfully
      }
    }

    setUploadProgress(100);
    setUploadComplete(true);
    toast.success(`Video uploaded successfully!`);
    
    // Call the callback with the video URL
    onVideoUploaded(videoType, publicUrl);
    
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Upload failed. Please try again or contact support if the problem persists.');
  } finally {
    setIsUploading(false);
  }
};
```

## Testing Phase 2

### Navigation Testing
1. **Sidebar Navigation**:
   - ✅ New Content button appears with dropdown arrow
   - ✅ Clicking shows "Voice Recording" and "Video Upload" options
   - ✅ Voice Recording navigates to `/voice-recording`
   - ✅ Video Upload navigates to `/video-upload`

2. **Drafts Page**:
   - ✅ Header has New Content button with dropdown
   - ✅ Both options work correctly

3. **Route Verification**:
   - ✅ `/voice-recording` page loads correctly
   - ✅ `/video-upload` page loads correctly
   - ✅ Old `/new` route no longer exists

### URL Testing
```bash
# Test routes manually
curl http://localhost:3000/voice-recording
curl http://localhost:3000/video-upload
curl http://localhost:3000/new  # Should return 404
```

## Completion Checklist

- [ ] ✅ NewContentButton component created with proper dropdown
- [ ] ✅ Sidebar navigation updated to use NewContentButton
- [ ] ✅ `/new` directory renamed to `/voice-recording`
- [ ] ✅ Voice recording page updated with project type
- [ ] ✅ Voice recording actions updated with project type
- [ ] ✅ `/video-upload` route structure created
- [ ] ✅ Video upload page and client component created
- [ ] ✅ Video upload actions created with project type
- [ ] ✅ Drafts page header updated to use NewContentButton
- [ ] ✅ Video upload modal integration completed
- [ ] ✅ All navigation flows tested
- [ ] ✅ Both project types create with correct project_type values
- [ ] ✅ No TypeScript errors

## Next Steps

Once Phase 2 is complete:
1. Test all navigation flows thoroughly
2. Verify project types are set correctly in database
3. Move to **Phase 3: Video Upload Implementation**

## Troubleshooting

### Component Issues
```bash
# If NewContentButton doesn't appear, check imports
npm run lint
npm run type-check
```

### Route Issues
```bash
# Verify Next.js recognizes new routes
npm run dev
# Check browser console for any routing errors
```

### Database Issues
```sql
-- Verify project types are being set correctly
SELECT id, content_title, project_type, created_at 
FROM content 
ORDER BY created_at DESC 
LIMIT 10;
``` 