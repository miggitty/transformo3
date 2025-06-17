'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ContentAsset, ContentWithBusiness } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { VideoPlayer } from '@/components/shared/video-player';

interface SocialShortVideoFormProps {
  asset: ContentAsset;
  content: ContentWithBusiness;
}

export default function SocialShortVideoForm({
  asset,
  content,
}: SocialShortVideoFormProps) {
  const [postContent, setPostContent] = useState(asset.content || '');

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
        <CardTitle>Social Short Video</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {content.video_short_url && (
          <div className="space-y-2">
            <Label>Video</Label>
            <VideoPlayer src={content.video_short_url} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="short-video-content">Post Content</Label>
          <Textarea
            id="short-video-content"
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            onBlur={e => handleSave('content', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
} 