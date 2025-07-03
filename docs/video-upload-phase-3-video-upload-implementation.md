# Video Upload Project - Phase 3: Video Upload Implementation

## Overview
This phase implements the core video upload functionality, N8N webhook handling, and ensures proper integration with the existing video transcription workflow. Complete Phases 1 and 2 before starting this phase.

## Implementation Steps

### Step 1: Update Video Upload Modal for Project Integration

#### File: `components/shared/video-upload-modal.tsx`
Enhance the existing modal to handle video upload projects:

```typescript
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, FileVideo, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { updateVideoUrl } from '@/app/actions/upload-post';
import { finalizeVideoUploadRecord } from '@/app/(app)/video-upload/actions';

interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: 'long' | 'short';
  contentId: string;
  businessId: string;
  onVideoUploaded: (videoType: 'long' | 'short', videoUrl: string) => void;
  isVideoUploadProject?: boolean; // New prop to identify video upload projects
}

const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400MB
const SUPPORTED_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime'];

export function VideoUploadModal({
  open,
  onOpenChange,
  videoType,
  contentId,
  businessId,
  onVideoUploaded,
  isVideoUploadProject = false, // Default to false for backward compatibility
}: VideoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadComplete, setUploadComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      toast.error('Please select a valid video file (MP4, WebM, or MOV)');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size must be less than 400MB');
      return;
    }

    setSelectedFile(file);
    setUploadComplete(false);
    setUploadProgress(0);
  };

  const getFileExtension = (file: File): string => {
    const mimeToExtension: Record<string, string> = {
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/quicktime': 'mov',
    };
    return mimeToExtension[file.type] || 'mp4';
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExtension = getFileExtension(selectedFile);
      // Use the established naming pattern for video uploads
      const fileName = isVideoUploadProject 
        ? `${businessId}_${contentId}_video_upload.${fileExtension}`
        : `${businessId}_${contentId}_${videoType}.${fileExtension}`;

      console.log('Starting video upload:', fileName);

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, selectedFile, {
          upsert: true,
          onUploadProgress: (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            setUploadProgress(Math.round(percent));
          },
        });

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        toast.error(`Unable to save video: ${uploadError.message || 'Please try again.'}`);
        return;
      }

      console.log('Video uploaded successfully to storage');

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

      console.log('Public URL generated:', publicUrl);

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

      console.log('Content record updated successfully');

      // If this is a video upload project, trigger the video transcription workflow
      if (isVideoUploadProject && videoType === 'long') {
        console.log('Triggering video transcription for video upload project');
        try {
          const finalizeResult = await finalizeVideoUploadRecord(contentId, publicUrl);
          if (finalizeResult.error) {
            console.error('Failed to trigger video transcription:', finalizeResult.error);
            toast.warning('Video uploaded successfully, but transcription may need to be retried.');
          } else {
            console.log('Video transcription triggered successfully');
          }
        } catch (error) {
          console.error('Error triggering video transcription:', error);
          toast.warning('Video uploaded successfully, but transcription may need to be retried.');
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

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      handleRemoveFile();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Upload {videoType === 'long' ? 'Long Form' : 'Short Form'} Video
            {isVideoUploadProject && ' (Main Project Video)'}
          </DialogTitle>
          <DialogDescription>
            Upload a video file (MP4, WebM, or MOV) up to 400MB in size.
            {isVideoUploadProject && ' This video will be transcribed and used to generate your content.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-file">Video File</Label>
            <Input
              id="video-file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileSelect}
              disabled={isUploading}
              ref={fileInputRef}
            />
          </div>

          {selectedFile && (
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileVideo className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                {!isUploading && !uploadComplete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {uploadComplete && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              {uploadComplete ? 'Close' : 'Cancel'}
            </Button>
            {!uploadComplete && (
              <Button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading ? 'Uploading...' : 'Upload Video'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 2: Update Video Upload Client Component

#### File: `app/(app)/video-upload/video-upload-client.tsx`
Update to pass the video upload project flag:

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
    toast.success('Video uploaded and transcription started!');
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
          isVideoUploadProject={true} // Flag this as a video upload project
        />
      )}
    </div>
  );
}
```

### Step 3: Enhance N8N Callback Handling

#### File: `app/api/n8n/callback/route.ts`
**IMPORTANT**: Video transcription should follow the EXACT same pattern as existing audio processing:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { PROJECT_TYPES } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('=== N8N Callback Received ===');
    console.log('Full callback payload:', JSON.stringify(body, null, 2));

    // Verify callback secret for security
    const callbackSecret = process.env.N8N_CALLBACK_SECRET;
    if (callbackSecret && body.callbackSecret !== callbackSecret) {
      console.error('Invalid callback secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Video transcription follows EXACT same pattern as audio processing
    // NO CHANGES needed to existing callback - it already handles both!
    
    // Current callback already does:
    // 1. If (transcript && content_title && !workflow_type) → Transcription complete → trigger content creation
    // 2. If (workflow_type === 'content_creation') → Content creation complete → generate assets
    
    // Video transcription N8N should send SAME format as audio:
    // {
    //   content_id: "uuid",
    //   transcript: "video transcript...",
    //   content_title: "AI-generated title",
    //   // NO workflow_type field for transcription callbacks
    // }
    
    // This will trigger existing audio processing logic:
    // - Sets status: 'completed'
    // - Auto-triggers content creation workflow
    // - Content creation generates assets
    // - Final determined status: 'draft'

  } catch (error) {
    console.error('N8N callback error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Step 4: Add Project Type Display Components

#### File: `components/shared/project-type-badge.tsx`
Create a reusable badge component for displaying project types:

```typescript
import { Badge } from '@/components/ui/badge';
import { Mic, Video } from 'lucide-react';
import { getProjectTypeLabel } from '@/lib/project-type';

interface ProjectTypeBadgeProps {
  projectType: string | null;
  showIcon?: boolean;
  variant?: 'default' | 'secondary' | 'outline';
}

export function ProjectTypeBadge({ 
  projectType, 
  showIcon = true,
  variant = 'secondary' 
}: ProjectTypeBadgeProps) {
  const label = getProjectTypeLabel(projectType);
  
  if (!projectType || projectType === 'voice_recording') {
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {showIcon && <Mic className="h-3 w-3" />}
        {label}
      </Badge>
    );
  }

  if (projectType === 'video_upload') {
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {showIcon && <Video className="h-3 w-3" />}
        {label}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      {label}
    </Badge>
  );
}
```

### Step 5: Add Error Handling and Retry Logic

#### File: `lib/retry-actions.ts`
Create retry actions for failed video processing:

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { PROJECT_TYPES } from '@/types';
import { revalidatePath } from 'next/cache';

export async function retryVideoTranscription(contentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'You must be logged in to retry processing.' };
  }

  // Get the content record
  const { data: content, error: fetchError } = await supabase
    .from('content')
    .select('*')
    .eq('id', contentId)
    .single();

  if (fetchError || !content) {
    return { error: 'Content not found.' };
  }

  // Check if this is a video upload project with a video URL
  if (content.project_type === PROJECT_TYPES.VIDEO_UPLOAD && !content.video_long_url) {
    return { error: 'No video found to process.' };
  }

  // Check if this is a voice recording project with an audio URL
  if (content.project_type === PROJECT_TYPES.VOICE_RECORDING && !content.audio_url) {
    return { error: 'No audio found to process.' };
  }

  // Reset status to processing
  const { error: updateError } = await supabase
    .from('content')
    .update({
      status: 'processing',
      content_generation_status: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  if (updateError) {
    console.error('Error updating content status:', updateError);
    return { error: 'Failed to update content status.' };
  }

  try {
    let webhookUrl: string | undefined;
    let payload: any;

    if (content.project_type === PROJECT_TYPES.VIDEO_UPLOAD) {
      // Retry video transcription
      webhookUrl = process.env.N8N_WEBHOOK_VIDEO_TRANSCRIPTION;
      
      let publicVideoUrl = content.video_long_url;
      if (process.env.NODE_ENV === 'development' && publicVideoUrl?.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
        const urlPath = publicVideoUrl.replace('http://127.0.0.1:54321', '');
        publicVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
      }

      payload = {
        video_url: publicVideoUrl,
        content_id: content.id,
        business_id: content.business_id,
        project_type: PROJECT_TYPES.VIDEO_UPLOAD,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
        callbackSecret: process.env.N8N_CALLBACK_SECRET,
        environment: process.env.NODE_ENV
      };
    } else {
      // Retry audio processing
      webhookUrl = process.env.N8N_WEBHOOK_URL_AUDIO_PROCESSING;
      
      let publicAudioUrl = content.audio_url;
      if (process.env.NODE_ENV === 'development' && publicAudioUrl?.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
        const urlPath = publicAudioUrl.replace('http://127.0.0.1:54321', '');
        publicAudioUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
      }

      payload = {
        audio_url: publicAudioUrl,
        content_id: content.id,
        business_id: content.business_id,
        project_type: PROJECT_TYPES.VOICE_RECORDING,
        callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
        callbackSecret: process.env.N8N_CALLBACK_SECRET,
        environment: process.env.NODE_ENV
      };
    }

    if (!webhookUrl) {
      return { error: 'Processing webhook not configured.' };
    }

    console.log(`Retrying ${content.project_type} processing for content ${contentId}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('N8N webhook failed:', errorText);
      
      // Reset to failed status
      await supabase
        .from('content')
        .update({
          status: 'failed',
          content_generation_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contentId);

      return { error: `Processing retry failed: ${response.statusText}` };
    }

    console.log('Processing retry triggered successfully');

    revalidatePath('/content');
    revalidatePath(`/content/${contentId}`);

    return { success: true, message: 'Processing retry started successfully' };
  } catch (error) {
    console.error('Error retrying processing:', error);
    
    // Reset to failed status
    await supabase
      .from('content')
      .update({
        status: 'failed',
        content_generation_status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId);

    return { error: 'Failed to retry processing workflow' };
  }
}
```

## Testing Phase 3

### Upload Flow Testing
1. **Video Upload Process**:
   ```bash
   # Test video upload project creation
   curl -X POST http://localhost:3000/api/test-video-upload
   ```

2. **File Validation**:
   - ✅ Test file size limits (400MB)
   - ✅ Test supported formats (MP4, WebM, MOV)
   - ✅ Test unsupported formats rejection

3. **N8N Integration**:
   - ✅ Verify video transcription webhook triggers
   - ✅ Verify content generation webhook triggers
   - ✅ Test callback handling for success/failure

### Database Testing
```sql
-- Verify video upload projects are created correctly
SELECT 
  id, 
  project_type, 
  status, 
  video_long_url, 
  transcript,
  content_generation_status,
  created_at 
FROM content 
WHERE project_type = 'video_upload' 
ORDER BY created_at DESC;
```

### Error Handling Testing
1. **Network Failures**:
   - Simulate N8N webhook unavailable
   - Test retry functionality
   - Verify status updates correctly

2. **File Upload Failures**:
   - Test Supabase storage errors
   - Test file corruption scenarios
   - Verify error messages to user

## Completion Checklist

- [ ] ✅ VideoUploadModal enhanced for project integration
- [ ] ✅ Video upload client component updated
- [ ] ✅ N8N callback handling updated for video transcription
- [ ] ✅ Project type badge component created
- [ ] ✅ Retry actions implemented for video processing
- [ ] ✅ File validation working (size + format)
- [ ] ✅ Video transcription workflow triggers correctly
- [ ] ✅ Content generation workflow triggers after transcription
- [ ] ✅ Error handling and retry functionality working
- [ ] ✅ Status updates working throughout the flow
- [ ] ✅ Navigation to drafts page after upload
- [ ] ✅ All TypeScript errors resolved

## Next Steps

Once Phase 3 is complete:
1. Test the complete video upload workflow end-to-end
2. Verify N8N webhook integrations work properly
3. Move to **Phase 4: Content Display Updates**

## Troubleshooting

### Upload Issues
```bash
# Check Supabase storage
supabase storage ls videos

# Check file permissions
supabase storage get-bucket videos
```

### N8N Webhook Issues
```bash
# Verify environment variables
echo $N8N_WEBHOOK_VIDEO_TRANSCRIPTION
echo $N8N_WEBHOOK_URL_CONTENT_CREATION

# Test webhook directly
curl -X POST $N8N_WEBHOOK_VIDEO_TRANSCRIPTION \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### Database Issues
```sql
-- Check project type values
SELECT DISTINCT project_type FROM content;

-- Check failed content
SELECT id, project_type, status, content_generation_status 
FROM content 
WHERE status = 'failed' 
ORDER BY created_at DESC;