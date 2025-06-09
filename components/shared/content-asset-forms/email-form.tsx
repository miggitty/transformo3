'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { RichTextEditor } from '../rich-text-editor';

interface EmailFormProps {
  asset: ContentAsset;
}

export default function EmailForm({ asset }: EmailFormProps) {
  const [headline, setHeadline] = useState(asset.headline || '');
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

  const handleContentUpdate = (newContent: string) => {
    setContent(newContent);
    handleSave('content', newContent);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            onBlur={e => handleSave('headline', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-body">Body</Label>
          <RichTextEditor
            initialContent={content}
            onUpdate={handleContentUpdate}
          />
        </div>
      </CardContent>
    </Card>
  );
} 