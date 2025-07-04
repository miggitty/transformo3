'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseBrowser } from '../providers/supabase-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

import { Loader2, Bot, Image as ImageIcon, Check } from 'lucide-react';
import { ContentAsset } from '@/types';
import { toast } from 'sonner';

interface ImageRegenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentAsset: ContentAsset;
  onImageUpdated?: (contentType: string) => void;
}

type RegenerationStep = 'edit-prompt' | 'generating' | 'compare-images';
type ImageSelection = 'current' | 'new';

export default function ImageRegenerationModal({
  open,
  onOpenChange,
  contentAsset,
  onImageUpdated,
}: ImageRegenerationModalProps) {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [step, setStep] = useState<RegenerationStep>('edit-prompt');
  const [imagePrompt, setImagePrompt] = useState(contentAsset.image_prompt || '');
  const [newImageUrl, setNewImageUrl] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<ImageSelection>('current');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setStep('edit-prompt');
      setImagePrompt(contentAsset.image_prompt || '');
      setNewImageUrl(null);
      setSelectedImage('current');
      setIsRegenerating(false);
    }
  }, [open, contentAsset.image_prompt]);

  const handleRegenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error('Please enter an image prompt');
      return;
    }

    setIsRegenerating(true);
    setStep('generating');

    try {
      // Call the image regeneration API
      const response = await fetch('/api/image-regeneration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content_asset_id: contentAsset.id,
          image_prompt: imagePrompt.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start image regeneration');
      }

      // Set up realtime listener for completion
      const channel = supabase
        .channel(`image-regen-${contentAsset.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'content_assets',
          filter: `id=eq.${contentAsset.id}`,
        }, (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedAsset = payload.new as any;
          if (updatedAsset.temporary_image_url) {
            setNewImageUrl(updatedAsset.temporary_image_url);
            setIsRegenerating(false);
            setStep('compare-images');
            supabase.removeChannel(channel);
            toast.success('New image generated successfully!');
          }
        })
        .subscribe();

      // Set timeout for failure case (5 minutes)
      setTimeout(() => {
        supabase.removeChannel(channel);
        if (step === 'generating') {
          setStep('edit-prompt');
          setIsRegenerating(false);
          toast.error('Image generation timed out. Please try again.');
        }
      }, 300000); // 5 minutes

      // Note: Cleanup will be handled by component unmount or timeout
      
    } catch (error) {
      console.error('Error regenerating image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to regenerate image. Please try again.';
      toast.error(errorMessage);
      setStep('edit-prompt');
      setIsRegenerating(false);
    }
  };

  const handleSave = async () => {
    if (selectedImage === 'new' && newImageUrl) {
      try {
        console.log('💾 Saving new image...');
        
        const response = await fetch(`/api/content-assets/${contentAsset.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            use_temporary_image: true,
            image_prompt: imagePrompt.trim(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save image');
        }

        console.log('✅ Image saved successfully, triggering cache refresh...');
        
        // Force refresh the image on server-side to bypass Vercel cache
        const updatedAsset = await response.json();
        if (updatedAsset.image_url) {
          try {
            await fetch('/api/image-refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl: updatedAsset.image_url })
            });
          } catch (error) {
            console.warn('Failed to refresh image cache:', error);
          }
        }
        
        // Trigger immediate cache busting for this content type
        if (onImageUpdated && contentAsset.content_type) {
          onImageUpdated(contentAsset.content_type);
          console.log(`🔄 Cache refresh triggered for ${contentAsset.content_type}`);
        }
        
        // Router refresh for complete data sync
        router.refresh();
        toast.success('Image updated successfully!');
        onOpenChange(false);
        
      } catch (error) {
        console.error('Error saving image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save image. Please try again.';
        toast.error(errorMessage);
        return; // Don't close modal on error
      }
    } else if (selectedImage === 'current') {
      try {
        // User kept current image - clear temporary and optionally update prompt
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
          cancel_temporary_image: true,
        };
        
        // Only update prompt if it changed
        if (imagePrompt !== contentAsset.image_prompt) {
          payload.image_prompt = imagePrompt.trim();
        }
        
        const response = await fetch(`/api/content-assets/${contentAsset.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save prompt');
        }

        const message = imagePrompt !== contentAsset.image_prompt 
          ? 'Image prompt updated successfully!' 
          : 'Temporary image cleared successfully!';
        toast.success(message);
        
        // Refresh page to show any prompt updates
        if (imagePrompt !== contentAsset.image_prompt) {
          router.refresh();
        }
      } catch (error) {
        console.error('Error saving prompt:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save prompt. Please try again.';
        toast.error(errorMessage);
        return; // Don't close modal on error
      }
    }
    
    // Close modal
    onOpenChange(false);
  };

  const handleCancel = async () => {
    // If there's a temporary image, clear it when canceling
    if (step === 'compare-images' && newImageUrl) {
      try {
        await fetch(`/api/content-assets/${contentAsset.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cancel_temporary_image: true,
          }),
        });
        
        // Refresh to clear any temporary state
        router.refresh();
      } catch (error) {
        console.error('Error clearing temporary image:', error);
        // Continue with cancel even if clearing fails
      }
    }
    
    onOpenChange(false);
  };

  const renderPromptEditStep = () => (
    <div className="space-y-6">
      {/* Current Image Preview */}
      {contentAsset.image_url && (
        <div className="space-y-2">
          <Label>Current Image</Label>
          <div className="relative w-full max-w-md mx-auto">
            <img
              src={contentAsset.image_url}
              alt="Current image"
              className="w-full h-auto max-h-80 object-contain rounded-lg border bg-gray-50"
            />
          </div>
        </div>
      )}

      {/* Prompt Editor */}
      <div className="space-y-2">
        <Label htmlFor="image-prompt">Image Prompt</Label>
        <Textarea
          id="image-prompt"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="min-h-[120px]"
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          Describe what you want the AI to generate. Be specific about style, colors, composition, etc.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleRegenerateImage}
          disabled={!imagePrompt.trim() || isRegenerating}
        >
          <Bot className="h-4 w-4 mr-2" />
          Regenerate Image
        </Button>
      </div>
    </div>
  );

  const renderGeneratingStep = () => (
    <div className="text-center space-y-6 py-8">
      <div className="flex justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-2">Generating your image...</h3>
        <p className="text-muted-foreground">
          Our AI is creating a new image based on your prompt. This usually takes 15-30 seconds.
        </p>
      </div>
    </div>
  );

  const renderCompareImagesStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Choose your preferred image</h3>
        <p className="text-muted-foreground">
          Select which image you&apos;d like to use, or edit the prompt below to generate another version.
        </p>
      </div>

      {/* Responsive Image Comparison Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Image */}
        <div className="space-y-3">
          <h4 className="font-medium text-center">Keep Current Image</h4>
          {contentAsset.image_url && (
            <div 
              className={`relative cursor-pointer transition-all duration-200 ${
                selectedImage === 'current' 
                  ? 'ring-4 ring-blue-500 ring-offset-2' 
                  : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1'
              }`}
              onClick={() => setSelectedImage('current')}
            >
              <img
                src={contentAsset.image_url}
                alt="Current image"
                className="w-full h-auto max-h-96 object-contain rounded-lg border bg-gray-50"
              />
              {selectedImage === 'current' && (
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* New Image */}
        <div className="space-y-3">
          <h4 className="font-medium text-center">Use New Image</h4>
          {newImageUrl ? (
            <div 
              className={`relative cursor-pointer transition-all duration-200 ${
                selectedImage === 'new' 
                  ? 'ring-4 ring-blue-500 ring-offset-2' 
                  : 'hover:ring-2 hover:ring-blue-300 hover:ring-offset-1'
              }`}
              onClick={() => setSelectedImage('new')}
            >
              <img
                src={newImageUrl}
                alt="New generated image"
                className="w-full h-auto max-h-96 object-contain rounded-lg border bg-gray-50"
              />
              {selectedImage === 'new' && (
                <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-96 bg-muted rounded-lg border flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Prompt Editor for Regenerating */}
      <div className="space-y-2 border-t pt-6">
        <Label htmlFor="compare-prompt">Edit Prompt to Generate Another Version</Label>
        <Textarea
          id="compare-prompt"
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          placeholder="Describe the image you want to generate..."
          className="min-h-[100px]"
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          Edit the prompt above and click &quot;Regenerate&quot; to create another version for comparison.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          variant="outline"
          onClick={handleRegenerateImage}
          disabled={!imagePrompt.trim() || isRegenerating}
        >
          <Bot className="h-4 w-4 mr-2" />
          Regenerate
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
      </div>
    </div>
  );

  const getDialogTitle = () => {
    switch (step) {
      case 'edit-prompt':
        return 'AI Image Regeneration';
      case 'generating':
        return 'Generating Image...';
      case 'compare-images':
        return 'Choose Your Preferred Image';
      default:
        return 'AI Image Regeneration';
    }
  };

  const getDialogDescription = () => {
    switch (step) {
      case 'edit-prompt':
        return 'Edit the prompt below to regenerate the image with AI.';
      case 'generating':
        return 'Please wait while we generate your new image.';
      case 'compare-images':
        return 'Select which image you prefer and save your changes.';
      default:
        return '';
    }
  };

  const getStepContent = () => {
    switch (step) {
      case 'edit-prompt':
        return renderPromptEditStep();
      case 'generating':
        return renderGeneratingStep();
      case 'compare-images':
        return renderCompareImagesStep();
      default:
        return renderPromptEditStep();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription>
            {getDialogDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {getStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
} 