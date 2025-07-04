'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { VideoUploadModal } from '@/components/shared/video-upload-modal';
import { Upload, Video, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createVideoUploadProject } from './actions';

type UploadStatus = 'idle' | 'creating' | 'uploading' | 'completed';

export function VideoUploadClient() {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const router = useRouter();

  const handleStartUpload = async () => {
    setStatus('creating');
    toast.info('Creating video upload project...');
    
    try {
      const result = await createVideoUploadProject();
      
      if (result.error) {
        toast.error(result.error);
        setStatus('idle');
        return;
      }

      if (result.data) {
        setContentId(result.data.id);
        setBusinessId(result.data.business_id);
        setUploadModalOpen(true);
        setStatus('uploading');
        toast.success('Project created! Please select your video file.');
      }
    } catch (error) {
      console.error('Error creating video upload project:', error);
      toast.error('Failed to start video upload project');
      setStatus('idle');
    }
  };

  const handleVideoUploaded = () => {
    setStatus('completed');
    setUploadModalOpen(false);
    toast.success('Video uploaded and transcription started!');
    
    // Navigate to drafts page to see the processing content
    setTimeout(() => {
      router.push('/content/drafts');
    }, 1500);
  };

  const handleModalClose = () => {
    if (status === 'uploading') {
      setUploadModalOpen(false);
      setStatus('idle');
      setContentId(null);
      setBusinessId(null);
    }
  };

  return (
    <div className="space-y-6">
      {status === 'idle' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Video className="h-16 w-16 text-muted-foreground" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Upload Your Video</h3>
            <p className="text-muted-foreground max-w-md">
              Upload a video file (MP4, WebM, or MOV) up to 400MB. We&apos;ll transcribe your video and generate content across multiple platforms.
            </p>
          </div>
          <Button 
            onClick={handleStartUpload}
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            Start Video Upload
          </Button>
        </div>
      )}

      {status === 'creating' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Video className="h-16 w-16 text-primary animate-pulse" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Preparing Upload...</h3>
            <p className="text-muted-foreground">
              Setting up your video upload project.
            </p>
          </div>
        </div>
      )}

      {status === 'uploading' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <Upload className="h-16 w-16 text-primary" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Upload Your Video</h3>
            <p className="text-muted-foreground">
              Select your video file in the modal that opened.
            </p>
          </div>
        </div>
      )}

      {status === 'completed' && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <div className="text-center space-y-2">
            <h3 className="text-lg font-medium">Upload Complete!</h3>
            <p className="text-muted-foreground">
              Your video is being transcribed. Redirecting to your drafts...
            </p>
          </div>
        </div>
      )}

      {/* Video Upload Modal */}
      {contentId && businessId && (
        <VideoUploadModal
          open={uploadModalOpen}
          onOpenChange={handleModalClose}
          videoType="long" // Use long video for the main video upload project
          contentId={contentId}
          businessId={businessId}
          onVideoUploaded={handleVideoUploaded}
          isVideoUploadProject={true}
        />
      )}
    </div>
  );
} 