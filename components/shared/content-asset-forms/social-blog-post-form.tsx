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

interface SocialBlogPostFormProps {
  asset: ContentAsset;
  disabled?: boolean;
}

export default function SocialBlogPostForm({ asset, disabled }: SocialBlogPostFormProps) {
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
        <CardTitle>Social Blog Post</CardTitle>
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
            >
              <Image
                src={asset.image_url}
                alt="Social Blog Post Image"
                width={320}
                height={180}
                className="rounded-lg"
              />
            </ImageWithRegeneration>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="social-blog-content">Post Content</Label>
          <Textarea
            id="social-blog-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
} 