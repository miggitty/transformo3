'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { ContentAsset } from '@/types';
import { updateContentAsset } from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import { RichTextEditor } from '../rich-text-editor';
import Image from 'next/image';

interface BlogPostFormProps {
  asset: ContentAsset;
  disabled?: boolean;
}

export default function BlogPostForm({ asset, disabled }: BlogPostFormProps) {
  const [headline, setHeadline] = useState(asset.headline || '');
  const [metaDescription, setMetaDescription] = useState(
    asset.blog_meta_description || ''
  );
  const [blogUrl, setBlogUrl] = useState(asset.blog_url || '');
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

  const handleContentUpdate = (newContent: string) => {
    if (disabled) return; // Prevent updates when disabled
    
    setContent(newContent);
    handleSave('content', newContent);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Blog Post</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="blog-title">Title</Label>
          <Input
            id="blog-title"
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            onBlur={e => handleSave('headline', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blog-meta-description">Meta Description</Label>
          <Textarea
            id="blog-meta-description"
            value={metaDescription}
            onChange={e => setMetaDescription(e.target.value)}
            onBlur={e => handleSave('blog_meta_description', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blog-url">URL</Label>
          <Input
            id="blog-url"
            value={blogUrl}
            onChange={e => setBlogUrl(e.target.value)}
            onBlur={e => handleSave('blog_url', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Blog Post Image</Label>
          {asset.image_url && (
            <Image
              src={asset.image_url}
              alt="Blog Post Image"
              width={320}
              height={180}
              className="rounded-lg"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="blog-content">Blog Content</Label>
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