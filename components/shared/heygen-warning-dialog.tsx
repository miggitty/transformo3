'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Bot, AlertTriangle, Loader2 } from 'lucide-react';

interface HeygenWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoType: 'long' | 'short';
  isGenerating?: boolean;
  onConfirm: () => void;
}

export function HeygenWarningDialog({
  open,
  onOpenChange,
  videoType,
  isGenerating = false,
  onConfirm,
}: HeygenWarningDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
      onOpenChange(false);
    }
  };

  const videoTypeDisplayName = videoType === 'long' ? 'long-form' : 'short-form';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Generate AI Video
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-3">
            <p>
              You are about to generate a {videoTypeDisplayName} AI avatar video using HeyGen. 
              This will incur API costs based on the video duration.
            </p>
            <p className="font-medium text-foreground">
              Before proceeding, please review the video script to ensure you&apos;re satisfied with the content.
            </p>
            <p className="text-sm text-muted-foreground">
              Once generation begins, you&apos;ll be charged even if you cancel the process.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isProcessing || isGenerating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isProcessing || isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Generate AI Video
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
} 