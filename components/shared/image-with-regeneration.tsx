'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';
import { ContentAsset } from '@/types';
import ImageRegenerationModal from './image-regeneration-modal';

interface ImageWithRegenerationProps {
  contentAsset: ContentAsset;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onImageUpdated?: () => void; // Callback to refresh content assets
}

export default function ImageWithRegeneration({
  contentAsset,
  children,
  disabled = false,
  className = '',
  onImageUpdated,
}: ImageWithRegenerationProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only show regeneration button if the content asset has an image
  const hasImage = contentAsset.image_url;

  if (!hasImage) {
    return <div className={className}>{children}</div>;
  }

  const handleRegenerationStart = () => {
    if (disabled) return;
    setIsModalOpen(true);
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      
      {/* AI Regeneration Button Overlay */}
      <Button
        variant="secondary"
        size="sm"
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm border border-gray-200 shadow-lg hover:bg-white hover:shadow-xl"
        onClick={handleRegenerationStart}
        disabled={disabled}
        aria-label="Regenerate image with AI"
      >
        <Bot className="h-4 w-4" />
      </Button>

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