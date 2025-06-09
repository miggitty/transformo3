'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';

interface SocialQuoteCardFormProps {
  asset: ContentAsset;
}

export default function SocialQuoteCardForm({
  asset,
}: SocialQuoteCardFormProps) {
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
        <CardTitle>Social Quote Card</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {asset.image_url && (
          <div className="space-y-2">
            <Label>Image</Label>
            <Image
              src={asset.image_url}
              alt="Social Quote Card Image"
              width={320}
              height={320}
              className="rounded-lg object-cover"
            />
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
          />
        </div>
      </CardContent>
    </Card>
  );
} 