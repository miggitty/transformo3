'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { ContentWithBusiness } from '@/types';
import { generateHeygenVideo } from '@/app/actions/settings';
import { VideoUploadCard } from '@/components/shared/video-upload-card';
import { VideoUploadModal } from './video-upload-modal';
import { DeleteVideoDialog } from './delete-video-dialog';
import { HeygenWarningDialog } from './heygen-warning-dialog';
import { useVideoGeneration } from '@/hooks/use-video-generation';

interface VideoSectionV2Props {
  content: ContentWithBusiness;
  onVideoUpdate: (videoType: 'long' | 'short', videoUrl: string | null) => void;
  onNavigateToScript?: (scriptType: 'main' | 'short') => void;
}

interface VideoSectionState {
  uploadModalOpen: boolean;
  uploadType: 'long' | 'short';
  deleteDialogOpen: boolean;
  deleteType: 'long' | 'short';
  warningDialogOpen: boolean;
  warningVideoType: 'long' | 'short';
}

export function VideoSectionV2({ content, onVideoUpdate, onNavigateToScript }: VideoSectionV2Props) {
  const [state, setState] = useState<VideoSectionState>({
    uploadModalOpen: false,
    uploadType: 'long',
    deleteDialogOpen: false,
    deleteType: 'long',
    warningDialogOpen: false,
    warningVideoType: 'long',
  });

  const router = useRouter();

  // Enhanced video generation hooks for both video types
  const longVideoGeneration = useVideoGeneration({
    contentId: content.id,
    videoType: 'long',
    onVideoUpdated: (videoUrl) => onVideoUpdate('long', videoUrl),
    onGenerationComplete: () => {
      setTimeout(() => longVideoGeneration.resetGeneration(), 2000);
    },
    onError: (errorType, message) => {
      console.error(`Long video generation error (${errorType}):`, message);
    }
  });

  const shortVideoGeneration = useVideoGeneration({
    contentId: content.id,
    videoType: 'short',
    onVideoUpdated: (videoUrl) => onVideoUpdate('short', videoUrl),
    onGenerationComplete: () => {
      setTimeout(() => shortVideoGeneration.resetGeneration(), 2000);
    },
    onError: (errorType, message) => {
      console.error(`Short video generation error (${errorType}):`, message);
    }
  });

  // Note: Real-time updates are now handled by the individual video generation hooks

  // Check HeyGen integration status
  const heygenIntegration = content.businesses?.ai_avatar_integrations?.find(
    integration => integration.provider === 'heygen' && integration.status === 'active'
  );

  const canGenerateAI = !!(
    heygenIntegration?.secret_id && 
    heygenIntegration?.avatar_id && 
    heygenIntegration?.voice_id
  );

  const handleUploadClick = (videoType: 'long' | 'short') => {
    setState(prev => ({
      ...prev,
      uploadModalOpen: true,
      uploadType: videoType,
    }));
  };

  const handleDeleteClick = (videoType: 'long' | 'short') => {
    setState(prev => ({
      ...prev,
      deleteDialogOpen: true,
      deleteType: videoType,
    }));
  };

  const handleGenerateAI = (videoType: 'long' | 'short') => {
    const script = videoType === 'long' ? content.video_script : content.short_video_script;
    
    if (!script) {
      toast.error(`${videoType === 'long' ? 'Main' : 'Short'} video script is required`);
      return;
    }

    if (!canGenerateAI) {
      toast.error('HeyGen integration is not properly configured');
      return;
    }

    // Show warning dialog instead of directly generating
    setState(prev => ({
      ...prev,
      warningDialogOpen: true,
      warningVideoType: videoType,
    }));
  };

  const handleGenerateAIConfirmed = async () => {
    const videoType = state.warningVideoType;
    const script = videoType === 'long' ? content.video_script : content.short_video_script;
    const generation = videoType === 'long' ? longVideoGeneration : shortVideoGeneration;
    
    if (!script) {
      toast.error(`${videoType === 'long' ? 'Main' : 'Short'} video script is required`);
      return;
    }

    if (!canGenerateAI) {
      toast.error('HeyGen integration is not properly configured');
      return;
    }

    // Start the generation state tracking
    generation.startGeneration();
    
    try {
      const result = await generateHeygenVideo(
        content.business_id!,
        content.id,
        script
      );

      if (result.error) {
        toast.error('Failed to start AI video generation', { description: result.error });
        // Reset generation state on error
        generation.resetGeneration();
      }
      // Note: Success feedback is now handled by the progress component
    } catch {
      toast.error('Failed to start AI video generation');
      // Reset generation state on error
      generation.resetGeneration();
    }
  };

  const handleConfigureIntegration = () => {
    router.push('/settings/integrations');
  };

  const handleReviewScript = (scriptType: 'main' | 'short') => {
    if (onNavigateToScript) {
      onNavigateToScript(scriptType);
    }
  };

  const handleVideoUpload = (videoType: 'long' | 'short', videoUrl: string) => {
    onVideoUpdate(videoType, videoUrl);
    setState(prev => ({ ...prev, uploadModalOpen: false }));
  };

  const handleVideoDelete = (videoType: 'long' | 'short') => {
    onVideoUpdate(videoType, null);
    setState(prev => ({ ...prev, deleteDialogOpen: false }));
  };

  const handleCloseUploadModal = (open: boolean) => {
    setState(prev => ({ ...prev, uploadModalOpen: open }));
  };

  const handleCloseDeleteDialog = (open: boolean) => {
    setState(prev => ({ ...prev, deleteDialogOpen: open }));
  };

  const handleCloseWarningDialog = (open: boolean) => {
    setState(prev => ({ ...prev, warningDialogOpen: open }));
  };

  return (
    <div className="space-y-6">
      {/* Two-column layout for long and short videos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in-50 duration-500">
        {/* Long Social Video Card */}
        <VideoUploadCard
          title="Long Social Video"
          videoType="long"
          videoUrl={content.video_long_url}
          scriptContent={content.video_script}
          scriptLabel="Main Video Script"
          isGenerating={longVideoGeneration.isGenerating}
          canGenerateAI={canGenerateAI}
          onUpload={() => handleUploadClick('long')}
          onGenerate={() => handleGenerateAI('long')}
          onDelete={() => handleDeleteClick('long')}
          onConfigureIntegration={handleConfigureIntegration}
          onReviewScript={() => handleReviewScript('main')}
        />

        {/* Short Social Video Card */}
        <VideoUploadCard
          title="Short Social Video"
          videoType="short"
          videoUrl={content.video_short_url}
          scriptContent={content.short_video_script}
          scriptLabel="Short Video Script"
          isGenerating={shortVideoGeneration.isGenerating}
          canGenerateAI={canGenerateAI}
          onUpload={() => handleUploadClick('short')}
          onGenerate={() => handleGenerateAI('short')}
          onDelete={() => handleDeleteClick('short')}
          onConfigureIntegration={handleConfigureIntegration}
          onReviewScript={() => handleReviewScript('short')}
        />
      </div>

      {/* Upload Modal */}
      <VideoUploadModal
        open={state.uploadModalOpen}
        onOpenChange={handleCloseUploadModal}
        contentId={content.id}
        businessId={content.business_id!}
        videoType={state.uploadType}
        onVideoUploaded={handleVideoUpload}
      />

      {/* Delete Dialog */}
      <DeleteVideoDialog
        open={state.deleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        contentId={content.id}
        businessId={content.business_id!}
        videoType={state.deleteType}
        onVideoDeleted={handleVideoDelete}
      />

      {/* HeyGen Warning Dialog */}
      <HeygenWarningDialog
        open={state.warningDialogOpen}
        onOpenChange={handleCloseWarningDialog}
        videoType={state.warningVideoType}
        isGenerating={state.warningVideoType === 'long' ? longVideoGeneration.isGenerating : shortVideoGeneration.isGenerating}
        onConfirm={handleGenerateAIConfirmed}
      />
    </div>
  );
} 