'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { ContentWithBusiness } from '@/types';
import { VideoUploadModal } from './video-upload-modal';
import { toast } from 'sonner';

interface VideoWithUploadDownloadProps {
  content: ContentWithBusiness;
  videoType: 'long' | 'short';
  children: React.ReactNode;
  className?: string;
  onVideoUpdated?: (videoType: 'long' | 'short', videoUrl: string | null) => void;
}

export default function VideoWithUploadDownload({
  content,
  videoType,
  children,
  className = '',
  onVideoUpdated,
}: VideoWithUploadDownloadProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const videoUrl = videoType === 'long' ? content.video_long_url : content.video_short_url;
  const hasVideo = !!videoUrl;

  if (!hasVideo) {
    return <div className={className}>{children}</div>;
  }

  const handleDownload = async () => {
    if (!videoUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      // Add cache busting to ensure we get the latest version
      const cacheBustedUrl = videoUrl.includes('?') ? `${videoUrl}&v=${Date.now()}` : `${videoUrl}?v=${Date.now()}`;
      const response = await fetch(cacheBustedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename using content title pattern
      const timestamp = new Date().toISOString().split('T')[0];
      const urlWithoutQuery = videoUrl.split('?')[0];
      const extension = urlWithoutQuery.split('.').pop() || 'mp4';
      const sanitizedTitle = (content.content_title || 'Video')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      a.download = `${sanitizedTitle}_social_${videoType}_video_${timestamp}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Video downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = () => {
    if (!content.businesses?.id) {
      toast.error('Business ID is required to upload videos.');
      return;
    }
    setIsUploadModalOpen(true);
  };

  const handleVideoUploaded = (uploadedVideoType: 'long' | 'short', videoUrl: string) => {
    if (onVideoUpdated) {
      onVideoUpdated(uploadedVideoType, videoUrl);
    }
    setIsUploadModalOpen(false);
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      
      {/* Button Group - appears on hover */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2">
        
        {/* Download Button */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label="Download video"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        
        {/* Upload Button */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
          onClick={handleUpload}
          aria-label="Upload new video"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      {/* Video Upload Modal - Reuse existing component */}
      {content.businesses?.id && (
        <VideoUploadModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          videoType={videoType}
          contentId={content.id}
          businessId={content.businesses.id}
          onVideoUploaded={handleVideoUploaded}
        />
      )}
    </div>
  );
} 