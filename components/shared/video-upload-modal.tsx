'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';
import { updateVideoUrl } from '@/app/(app)/content/[id]/actions';
import { Upload, X, Video, Loader2, CheckCircle } from 'lucide-react';

interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: 'long' | 'short';
  contentId: string;
  businessId: string;
  onVideoUploaded: (videoType: 'long' | 'short', videoUrl: string) => void;
}

export function VideoUploadModal({
  open,
  onOpenChange,
  videoType,
  contentId,
  businessId,
  onVideoUploaded,
}: VideoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Reset modal state when it opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadComplete(false);
      setIsDragOver(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  const ACCEPTED_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime'];
  const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400MB

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      return 'Please select a valid video file (MP4, WebM, or MOV)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be under 400MB. Please select a smaller file.';
    }
    return null;
  };

  const getFileExtension = (file: File): string => {
    if (file.type === 'video/mp4') return 'mp4';
    if (file.type === 'video/webm') return 'webm';
    if (file.type === 'video/quicktime') return 'mov';
    return 'mp4'; // fallback
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    setUploadComplete(false);
    setUploadProgress(0);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file to upload');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExtension = getFileExtension(selectedFile);
      const fileName = `${businessId}_${contentId}_${videoType}.${fileExtension}`;

      // Simulate progress for better UX (since Supabase doesn't provide real progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, selectedFile, {
          upsert: true, // Replace existing file if it exists
        });

      clearInterval(progressInterval);

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

      // In local development, convert local Supabase URLs to external Supabase URLs for external services access
      if (process.env.NODE_ENV === 'development' && publicUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
        // Extract the path from the local Supabase URL and construct external Supabase URL
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

      setUploadProgress(100);
      setUploadComplete(true);
      toast.success(`${videoType === 'long' ? 'Long' : 'Short'} video uploaded successfully!`);
      
      // Call the callback with the video URL
      onVideoUploaded(videoType, publicUrl);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Upload failed. Please try again or contact support if the problem persists.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      onOpenChange(false);
      // State will be reset by useEffect when modal opens again
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload {videoType === 'long' ? 'Long' : 'Short'} Video
          </DialogTitle>
          <DialogDescription>
            Upload a video file (MP4, WebM, or MOV) up to 400MB.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedFile ? (
            <>
              {/* Drag & Drop Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  Drop your video here
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Or click to browse files
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Browse Files
                </Button>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="text-xs text-muted-foreground">
                <p>Supported formats: MP4 (recommended), WebM, MOV</p>
                <p>Maximum file size: 400MB</p>
              </div>
            </>
          ) : (
            <>
              {/* Selected File Info */}
              <div className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Video className="h-8 w-8 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  {!isUploading && !uploadComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Upload Progress */}
                {isUploading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}

                {/* Upload Complete */}
                {uploadComplete && (
                  <div className="mt-4 flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Upload complete!</span>
                  </div>
                )}
              </div>

              {/* Upload Button */}
              {!uploadComplete && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedFile(null)}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Video
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 