'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { updateVideoUrl } from '@/app/(app)/content/[id]/actions';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: 'long' | 'short';
  contentId: string;
  businessId: string;
  onVideoDeleted: (videoType: 'long' | 'short') => void;
}

export function DeleteVideoDialog({
  open,
  onOpenChange,
  videoType,
  contentId,
  businessId,
  onVideoDeleted,
}: DeleteVideoDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const supabase = createClient();

  const handleDelete = async () => {
    if (!supabase) {
      toast.error('Database connection unavailable.');
      return;
    }

    setIsDeleting(true);
    
    try {
      // Get the current video URL to extract the filename
      const { data: content, error: fetchError } = await supabase
        .from('content')
        .select('video_long_url, video_short_url')
        .eq('id', contentId)
        .single();

      if (fetchError) {
        toast.error('Failed to fetch video information');
        return;
      }

      const videoUrl = videoType === 'long' ? content?.video_long_url : content?.video_short_url;
      
      if (videoUrl) {
        // Extract filename using the correct pattern to match RLS policy
        const filename = `${businessId}_${contentId}_${videoType}`;
        
        // Delete from Supabase Storage (try both common video extensions)
        const extensions = ['mp4', 'webm', 'mov'];
        for (const ext of extensions) {
          await supabase.storage
            .from('videos')
            .remove([`${filename}.${ext}`]);
        }
      }

      // Update database to remove video URL using server action
      const { success, error: updateError } = await updateVideoUrl({
        contentId,
        videoType,
        videoUrl: null,
      });

      if (!success) {
        toast.error(updateError || 'Failed to update content record');
        return;
      }

      toast.success(`${videoType === 'long' ? 'Long' : 'Short'} video deleted successfully`);
      onVideoDeleted(videoType);
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete {videoType === 'long' ? 'Long' : 'Short'} Video
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this video? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Video
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 