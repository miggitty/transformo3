'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';
import ImageWithRegeneration from '@/components/shared/image-with-regeneration';

interface SocialQuoteCardFormProps {
  asset: ContentAsset;
  disabled?: boolean;
  onImageUpdated?: (updatedAsset: ContentAsset) => void;
}

export default function SocialQuoteCardForm({
  asset,
  disabled,
  onImageUpdated,
}: SocialQuoteCardFormProps) {
  const [content, setContent] = useState(asset.content || '');

  const handleSave = async (field: string, value: string) => {
    if (disabled) return; // Prevent saving when disabled
    
    const { success, error } = await updateContentAsset(asset.id, {
      [field]: value,
    });
    if (success) {
      toast.success('Content saved!');
    } else {
      toast.error(`Error saving: ${error}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Quote Card</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {asset.image_url && (
          <div className="space-y-2">
            <Label>Image</Label>
            <ImageWithRegeneration 
              contentAsset={asset}
              disabled={disabled}
              className="inline-block"
              onImageUpdated={onImageUpdated}
              enableDownload={true}
              enableUpload={true}
              enableRegeneration={true}
            >
              <Image
                src={asset.image_url}
                alt="Social Quote Card Image"
                width={320}
                height={320}
                className="rounded-lg object-cover"
              />
            </ImageWithRegeneration>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="quote-card-content">Post Content</Label>
          <Textarea
            id="quote-card-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
            rows={5}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
} 