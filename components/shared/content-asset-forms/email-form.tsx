'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { RichTextEditor } from '../rich-text-editor';

interface EmailFormProps {
  asset: ContentAsset;
  disabled?: boolean;
}

export default function EmailForm({ asset, disabled }: EmailFormProps) {
  const [subject, setSubject] = useState(asset.headline || '');
  const [content, setContent] = useState(asset.content || '');

  const handleSave = async (field: string, value: string) => {
    if (disabled) return; // Prevent saving when disabled
    
    const { success, error } = await updateContentAsset(asset.id, {
      [field]: value,
    });
    if (success) {
      toast.success('Email content saved!');
    } else {
      toast.error(`Error saving: ${error}`);
    }
  };

  const handleContentUpdate = (newContent: string) => {
    if (disabled) return; // Prevent updates when disabled
    
    setContent(newContent);
    handleSave('content', newContent);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email-subject">Subject</Label>
          <Input
            id="email-subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            onBlur={e => handleSave('headline', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-content">Email Content</Label>
          <RichTextEditor
            initialContent={content}
            onUpdate={handleContentUpdate}
            disabled={disabled}
          />
        </div>
      </CardContent>
    </Card>
  );
} 