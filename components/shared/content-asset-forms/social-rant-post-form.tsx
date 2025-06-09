'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';

interface SocialRantPostFormProps {
  asset: ContentAsset;
}

export default function SocialRantPostForm({ asset }: SocialRantPostFormProps) {
  const [content, setContent] = useState(asset.content || '');

  const handleSave = async (field: string, value: string) => {
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
        <CardTitle>Social Rant Post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {asset.image_url && (
          <div className="space-y-2">
            <Label>Image</Label>
            <Image
              src={asset.image_url}
              alt="Social Rant Post Image"
              width={320}
              height={180}
              className="rounded-lg"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="rant-content">Post Content</Label>
          <Textarea
            id="rant-content"
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
} 