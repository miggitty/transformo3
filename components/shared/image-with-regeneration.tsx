'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Download, Upload, Loader2 } from 'lucide-react';
import { ContentAsset } from '@/types';
import ImageRegenerationModal from './image-regeneration-modal';
import { toast } from 'sonner';

interface ImageWithRegenerationProps {
  contentAsset: ContentAsset;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onImageUpdated?: (updatedAsset: ContentAsset) => void;
  // NEW: Enable/disable specific features
  enableDownload?: boolean;
  enableUpload?: boolean;
  enableRegeneration?: boolean;
}

export default function ImageWithRegeneration({
  contentAsset,
  children,
  disabled = false,
  className = '',
  onImageUpdated,
  enableDownload = true,
  enableUpload = true,
  enableRegeneration = true,
}: ImageWithRegenerationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Only show buttons if the content asset has an image
  const hasImage = contentAsset.image_url;

  if (!hasImage) {
    return <div className={className}>{children}</div>;
  }

  const handleRegenerationStart = () => {
    if (disabled) return;
    setIsModalOpen(true);
  };

  const handleDownload = async () => {
    if (!contentAsset.image_url || isDownloading) return;

    setIsDownloading(true);

    try {
      // Fetch image data
      const response = await fetch(contentAsset.image_url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const urlWithoutQuery = contentAsset.image_url.split('?')[0]; // Remove query params
      const extension = urlWithoutQuery.split('.').pop() || 'jpg';
      a.download = `${contentAsset.content_type}_image_${timestamp}.${extension}`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Image downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download image');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    // Additional validation for supported formats
    const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      toast.error('Please select a JPG, PNG, or WebP image');
      return;
    }

    setIsUploading(true);
    
    try {
      // Create FormData for API call
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contentAssetId', contentAsset.id);
      formData.append('contentType', contentAsset.content_type || 'blog_post');

      // Call upload API
      const response = await fetch('/api/upload-image-replace', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update UI with new image
        if (onImageUpdated) {
          onImageUpdated({
            ...contentAsset,
            image_url: result.imageUrl,
          });
        }
        toast.success('Image uploaded successfully!');
      } else {
        const errorMessage = result.error || 'Upload failed';
        console.error('Upload failed:', result);
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      
      {/* Button Group - appears on hover */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2">
        
        {/* Download Button */}
        {enableDownload && (
          <Button
            variant="secondary"
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
            onClick={handleDownload}
            disabled={disabled || isDownloading}
            aria-label="Download image"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {/* Upload Button */}
        {enableUpload && (
          <Button
            variant="secondary"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
            onClick={handleUpload}
            disabled={disabled || isUploading}
            aria-label="Upload new image"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        )}
        
        {/* AI Regeneration Button (existing) */}
        {enableRegeneration && (
          <Button
            variant="secondary"
            size="sm"
            className={`bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
            onClick={handleRegenerationStart}
            disabled={disabled}
            aria-label="Regenerate image with AI"
          >
            <Bot className="h-4 w-4 mr-1" />
            <span className="text-xs font-medium">AI</span>
          </Button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".jpg,.jpeg,.png,.webp"
        onChange={handleFileSelect}
      />

      {/* Image Regeneration Modal */}
      <ImageRegenerationModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        contentAsset={contentAsset}
        onImageUpdated={onImageUpdated}
      />
    </div>
  );
} 