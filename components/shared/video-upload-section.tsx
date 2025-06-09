'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Video, Trash2 } from 'lucide-react';
import { ContentWithBusiness } from '@/types';
import { toast } from 'sonner';
import { VideoUploadModal } from './video-upload-modal';
import { VideoPlayer } from './video-player';
import { DeleteVideoDialog } from './delete-video-dialog';

interface VideoUploadSectionProps {
  content: ContentWithBusiness;
  onVideoUpdate: (videoType: 'long' | 'short', videoUrl: string | null) => void;
}

export default function VideoUploadSection({
  content,
  onVideoUpdate,
}: VideoUploadSectionProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadType, setUploadType] = useState<'long' | 'short'>('long');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'long' | 'short'>('long');

  const handleUploadClick = (type: 'long' | 'short') => {
    if (!content.business_id) {
      toast.error('Business ID is required to upload videos.');
      return;
    }
    setUploadType(type);
    setUploadModalOpen(true);
  };

  const handleDeleteClick = (type: 'long' | 'short') => {
    if (!content.business_id) {
      toast.error('Business ID is required to delete videos.');
      return;
    }
    setDeleteType(type);
    setDeleteDialogOpen(true);
  };

  const handleVideoUploaded = (videoType: 'long' | 'short', videoUrl: string) => {
    onVideoUpdate(videoType, videoUrl);
    setUploadModalOpen(false);
  };

  const handleVideoDeleted = (videoType: 'long' | 'short') => {
    onVideoUpdate(videoType, null);
    setDeleteDialogOpen(false);
  };

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Long Video Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Long Social Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {content.video_long_url ? (
              <div className="space-y-4">
                <VideoPlayer src={content.video_long_url} />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUploadClick('long')}
                    variant="outline"
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Video
                  </Button>
                  <Button
                    onClick={() => handleDeleteClick('long')}
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Video className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                  No long video uploaded yet
                </p>
                <Button onClick={() => handleUploadClick('long')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Long Video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Short Video Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Short Social Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {content.video_short_url ? (
              <div className="space-y-4">
                <VideoPlayer src={content.video_short_url} />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUploadClick('short')}
                    variant="outline"
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Video
                  </Button>
                  <Button
                    onClick={() => handleDeleteClick('short')}
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Video className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                  No short video uploaded yet
                </p>
                <Button onClick={() => handleUploadClick('short')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Short Video
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Modal */}
      <VideoUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        videoType={uploadType}
        contentId={content.id}
        businessId={content.business_id!}
        onVideoUploaded={handleVideoUploaded}
      />

      {/* Delete Dialog */}
      <DeleteVideoDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        videoType={deleteType}
        contentId={content.id}
        businessId={content.business_id!}
        onVideoDeleted={handleVideoDeleted}
      />
    </div>
  );
} 