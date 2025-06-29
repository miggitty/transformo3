'use client';

import { useState, useEffect } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Bot, Image as ImageIcon } from 'lucide-react';
import { ContentAsset } from '@/types';
import { toast } from 'sonner';

interface ImageRegenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentAsset: ContentAsset;
}

type RegenerationStep = 'edit-prompt' | 'generating' | 'compare-images';
type ImageSelection = 'current' | 'new';

export default function ImageRegenerationModal({
  open,
  onOpenChange,
  contentAsset,
}: ImageRegenerationModalProps) {
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

      // Start polling for completion
      const startPolling = () => {
        const pollInterval = setInterval(async () => {
          try {
            // Check if the content asset has been updated with a temporary image
            const checkResponse = await fetch(`/api/content-assets/${contentAsset.id}`);
            if (checkResponse.ok) {
              const updatedAsset = await checkResponse.json();
              
              // Check if temporary_image_url is populated (indicating completion)
              if (updatedAsset.temporary_image_url) {
                clearInterval(pollInterval);
                setNewImageUrl(updatedAsset.temporary_image_url);
                setStep('compare-images');
                toast.success('New image generated successfully!');
              }
              // Continue polling if no change yet
            }
          } catch (error) {
            console.error('Error polling for completion:', error);
            // Continue polling despite error
          }
        }, 2000); // Poll every 2 seconds

        // Stop polling after 5 minutes (timeout)
        setTimeout(() => {
          clearInterval(pollInterval);
          if (step === 'generating') {
            setStep('edit-prompt');
            toast.error('Image generation timed out. Please try again.');
          }
        }, 300000); // 5 minutes
      };

      startPolling();
      
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
        // Move temporary image to permanent and update prompt
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

        toast.success('Image updated successfully!');
        
        // Trigger a page refresh to show the new image
        window.location.reload();
        
      } catch (error) {
        console.error('Error saving image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to save image. Please try again.';
        toast.error(errorMessage);
        return; // Don't close modal on error
      }
    } else if (selectedImage === 'current') {
      try {
        // User kept current image - clear temporary and optionally update prompt
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
              className="w-full h-48 object-cover rounded-lg border"
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
          Select which image you'd like to use and click Save to apply your choice.
        </p>
      </div>

              <RadioGroup 
          value={selectedImage} 
          onValueChange={(value: string) => setSelectedImage(value as ImageSelection)}
        >
        {/* Responsive Image Comparison Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current Image */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="current" id="current-image" />
              <Label htmlFor="current-image" className="font-medium">
                Keep Current Image
              </Label>
            </div>
            {contentAsset.image_url && (
              <div className="relative">
                <img
                  src={contentAsset.image_url}
                  alt="Current image"
                  className="w-full h-48 object-cover rounded-lg border"
                />
              </div>
            )}
          </div>

          {/* New Image */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new-image" />
              <Label htmlFor="new-image" className="font-medium">
                Use New Image
              </Label>
            </div>
            {newImageUrl ? (
              <div className="relative">
                <img
                  src={newImageUrl}
                  alt="New generated image"
                  className="w-full h-48 object-cover rounded-lg border"
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg border flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </RadioGroup>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-between">
        <Button 
          variant="outline" 
          onClick={() => setStep('edit-prompt')}
          disabled={isRegenerating}
        >
          <Bot className="h-4 w-4 mr-2" />
          Regenerate Again
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );

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

  const getDialogTitle = () => {
    switch (step) {
      case 'edit-prompt':
        return 'Regenerate Image with AI';
      case 'generating':
        return 'Generating Image';
      case 'compare-images':
        return 'Choose Your Image';
      default:
        return 'Regenerate Image with AI';
    }
  };

  const getDialogDescription = () => {
    switch (step) {
      case 'edit-prompt':
        return 'Edit the prompt below to customize how the AI generates your new image.';
      case 'generating':
        return 'Please wait while we generate your new image.';
      case 'compare-images':
        return 'Compare the images and select which one you want to keep.';
      default:
        return 'Edit the prompt below to customize how the AI generates your new image.';
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