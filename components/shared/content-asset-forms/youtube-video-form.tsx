'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ContentAsset, ContentWithBusiness } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';

interface YouTubeVideoFormProps {
  asset: ContentAsset;
  content: ContentWithBusiness;
}

export default function YouTubeVideoForm({
  asset,
  content,
}: YouTubeVideoFormProps) {
  const [headline, setHeadline] = useState(asset.headline || '');
  const [description, setDescription] = useState(asset.content || '');

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
        <CardTitle>YouTube Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="youtube-title">Video Title</Label>
          <Input
            id="youtube-title"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            onBlur={e => handleSave('headline', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtube-description">Description</Label>
          <Textarea
            id="youtube-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
          />
        </div>
        {asset.image_url && (
          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <Image
              src={asset.image_url}
              alt="YouTube Thumbnail"
              width={320}
              height={180}
              className="rounded-lg"
            />
          </div>
        )}
        {content.video_long_url && (
          <div className="space-y-2">
            <Label>Video</Label>
            <video
              src={content.video_long_url}
              controls
              className="w-full rounded-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
} 