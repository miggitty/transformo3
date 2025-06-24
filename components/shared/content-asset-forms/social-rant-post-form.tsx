'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';

interface SocialRantPostFormProps {
  asset: ContentAsset;
  disabled?: boolean;
}

export default function SocialRantPostForm({ asset, disabled }: SocialRantPostFormProps) {
  const [content, setContent] = useState(asset.content || '');

  const handleSave = async (field: string, value: string) => {
    if (disabled) return; // Prevent saving when disabled
    
    const { success, error } = await updateContentAsset(asset.id, {
      [field]: value,
    });
    if (success) {
      toast.success('Social rant post saved!');
    } else {
      toast.error(`Error saving: ${error}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Social Rant Post</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Post Image</Label>
          {asset.image_url && (
            <Image
              src={asset.image_url}
              alt="Social Rant Post Image"
              width={320}
              height={180}
              className="rounded-lg"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="social-rant-content">Post Content</Label>
          <Textarea
            id="social-rant-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
            className="min-h-[120px]"
            placeholder="Write your social rant post here..."
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
} 