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
import { createClientSafe } from '@/utils/supabase/client';
import { updateVideoUrl } from '@/app/(app)/content/[id]/actions';
import { finalizeVideoUploadRecord } from '@/app/(app)/video-upload/actions';
import { Upload, X, Video, Loader2, CheckCircle } from 'lucide-react';
import * as tus from 'tus-js-client';

interface VideoUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: 'long' | 'short';
  contentId: string;
  businessId: string;
  onVideoUploaded: (videoType: 'long' | 'short', videoUrl: string) => void;
  isVideoUploadProject?: boolean; // Flag for video upload projects
}

const ACCEPTED_FORMATS = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 400 * 1024 * 1024; // 400MB

export function VideoUploadModal({
  open,
  onOpenChange,
  videoType,
  contentId,
  businessId,
  onVideoUploaded,
  isVideoUploadProject = false,
}: VideoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tusUpload, setTusUpload] = useState<tus.Upload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClientSafe();

  // Reset modal state when it opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setUploadProgress(0);
      setIsUploading(false);
      setUploadComplete(false);
      setIsDragOver(false);
      setTusUpload(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [open]);

  // Cleanup TUS upload on unmount or when modal closes
  useEffect(() => {
    return () => {
      if (tusUpload) {
        tusUpload.abort();
      }
    };
  }, [tusUpload]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      return 'Please select a valid video file (MP4, WebM, or MOV)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be under 400MB. Please select a smaller file.';
    }
    return null;
  }, []);

  const getFileExtension = (file: File): string => {
    if (file.type === 'video/mp4') return 'mp4';
    if (file.type === 'video/webm') return 'webm';
    if (file.type === 'video/quicktime') return 'mov';
    return 'mp4'; // fallback
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;
    
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }
    setSelectedFile(file);
    setUploadComplete(false);
    setUploadProgress(0);
    setTusUpload(null);
  }, [validateFile]);

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

      // Get the Supabase storage URL for TUS uploads
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const bucketName = 'videos';
      const tusEndpoint = `${projectUrl}/storage/v1/upload/resumable`;

      // First, try to delete the existing file if it exists to avoid conflicts
      try {
        await supabase.storage
          .from('videos')
          .remove([fileName]);
        console.log('Existing file removed successfully');
      } catch (deleteError) {
        console.log('No existing file to remove or removal failed:', deleteError);
        // Continue with upload anyway
      }

      // Create TUS upload with proper Supabase metadata format
      const upload = new tus.Upload(selectedFile, {
        endpoint: tusEndpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: fileName,
          bucketName: bucketName,
          objectName: fileName,
          contentType: selectedFile.type || 'video/mp4',
          cacheControl: '3600',
          upsert: 'true', // Enable upsert for conflicts
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true', // Additional upsert header
        },
        // Add more robust error handling
        onError: (error) => {
          console.error('TUS upload error:', error);
          
          // Handle specific error cases
          let statusCode: number | undefined;
          
          // Check if it's a DetailedError with originalResponse
          if ('originalResponse' in error && error.originalResponse) {
            statusCode = error.originalResponse.getStatus();
          }
          
          if (statusCode === 409) {
            toast.error('File already exists. Please try again or choose a different file.');
          } else if (statusCode === 401) {
            toast.error('Authentication failed. Please refresh the page and try again.');
          } else if (statusCode === 413) {
            toast.error('File too large. Please choose a smaller file.');
          } else {
            toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
          }
          
          setIsUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(percentage);
        },
        onSuccess: async () => {
          try {
            console.log('TUS upload completed successfully');
            
            // Wait a moment for the file to be fully processed
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get the public URL
            const { data: publicUrlData } = supabase.storage
              .from('videos')
              .getPublicUrl(fileName);

            let publicUrl = publicUrlData.publicUrl;

            // In local development, convert local Supabase URLs to external Supabase URLs for external services access
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

            setUploadComplete(true);
            toast.success(`${videoType === 'long' ? 'Long' : 'Short'} video uploaded successfully!`);
            
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

            // Call the callback with the video URL
            onVideoUploaded(videoType, publicUrl);
            
          } catch (error) {
            console.error('Post-upload processing error:', error);
            toast.error('Upload completed but failed to process. Please contact support.');
          } finally {
            setIsUploading(false);
          }
        },
      });

      // Store the upload instance for potential cancellation
      setTusUpload(upload);

      // Start the upload
      upload.start();
      
    } catch (error) {
      console.error('Upload setup error:', error);
      toast.error('Failed to start upload. Please try again or contact support if the problem persists.');
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    if (tusUpload && isUploading) {
      tusUpload.abort();
      setTusUpload(null);
      setIsUploading(false);
      setUploadProgress(0);
      toast.info('Upload cancelled');
    }
    setSelectedFile(null);
  };

  const handleClose = () => {
    if (isUploading) {
      // Ask user if they want to cancel the upload
      if (confirm('Upload is in progress. Are you sure you want to cancel?')) {
        if (tusUpload) {
          tusUpload.abort();
        }
        setIsUploading(false);
        setUploadProgress(0);
        setTusUpload(null);
        onOpenChange(false);
      }
    } else {
      onOpenChange(false);
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
            Upload a video file (MP4, WebM, or MOV) up to 400MB. Large files use resumable uploads for better reliability.
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
                <p>Large files will use resumable uploads for better reliability</p>
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
                      <span>Uploading... (resumable)</span>
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
                    onClick={handleCancel}
                    disabled={false}
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