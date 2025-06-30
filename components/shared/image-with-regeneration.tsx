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
        className={`absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105 ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        onClick={handleRegenerationStart}
        disabled={disabled}
        aria-label="Regenerate image with AI"
      >
        <Bot className="h-4 w-4 mr-1" />
        <span className="text-xs font-medium">AI</span>
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