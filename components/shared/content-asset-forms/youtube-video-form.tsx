'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ContentAsset, ContentWithBusiness } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import Image from 'next/image';
import { VideoPlayer } from '@/components/shared/video-player';

interface YouTubeVideoFormProps {
  asset: ContentAsset;
  content: ContentWithBusiness;
  disabled?: boolean;
}

export default function YouTubeVideoForm({
  asset,
  content,
  disabled,
}: YouTubeVideoFormProps) {
  const [headline, setHeadline] = useState(asset.headline || '');
  const [description, setDescription] = useState(asset.content || '');

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
        <CardTitle>YouTube Video</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="youtube-title">Video Title</Label>
          <Input
            id="youtube-title"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            onBlur={e => handleSave('headline', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="youtube-description">Description</Label>
          <Textarea
            id="youtube-description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
            disabled={disabled}
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
            <VideoPlayer src={content.video_long_url} />
          </div>
        )}
      </CardContent>
    </Card>
  );
} 