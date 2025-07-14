'use client';

import { Button } from '@/components/ui/button';
import { Upload, Bot, Trash2, Loader2 } from 'lucide-react';

interface VideoActionButtonsProps {
  videoUrl: string | null;
  isGenerating: boolean;
  canGenerateAI: boolean;
  hasScript: boolean;
  onUpload: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}

export function VideoActionButtons({
  videoUrl,
  isGenerating,
  canGenerateAI,
  hasScript,
  onUpload,
  onGenerate,
  onDelete,
}: VideoActionButtonsProps) {
  const canGenerate = canGenerateAI && hasScript;

  return (
    <div className="flex gap-2">
      <Button onClick={onUpload} className="flex-1">
        <Upload className="w-4 h-4 mr-2" />
        {videoUrl ? 'Upload New' : 'Upload Video'}
      </Button>
      
      <Button 
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
        variant="secondary"
        className="flex-1"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Bot className="w-4 h-4 mr-2" />
            Generate AI
          </>
        )}
      </Button>
      
      {videoUrl && (
        <Button onClick={onDelete} variant="destructive" size="sm">
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
} 