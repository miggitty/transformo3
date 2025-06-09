'use client';

import { ContentAsset, ContentWithBusiness } from '@/types';
import YouTubeVideoForm from './content-asset-forms/youtube-video-form';
import EmailForm from './content-asset-forms/email-form';
import BlogPostForm from './content-asset-forms/blog-post-form';
import SocialRantPostForm from './content-asset-forms/social-rant-post-form';
import SocialBlogPostForm from './content-asset-forms/social-blog-post-form';
import SocialLongVideoForm from './content-asset-forms/social-long-video-form';
import SocialShortVideoForm from './content-asset-forms/social-short-video-form';
import SocialQuoteCardForm from './content-asset-forms/social-quote-card-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ContentAssetsManagerProps {
  assets: ContentAsset[];
  content: ContentWithBusiness['content'];
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  isGenerating: boolean;
}

export default function ContentAssetsManager({
  assets,
  content,
  isLoading,
  error,
  onGenerate,
  isGenerating,
}: ContentAssetsManagerProps) {
  const renderAssetForm = (asset: ContentAsset) => {
    switch (asset.content_type) {
      case 'youtube_video':
        return <YouTubeVideoForm asset={asset} content={content} />;
      case 'email':
        return <EmailForm asset={asset} />;
      case 'blog_post':
        return <BlogPostForm asset={asset} />;
      case 'social_rant_post':
        return <SocialRantPostForm asset={asset} />;
      case 'social_blog_post':
        return <SocialBlogPostForm asset={asset} />;
      case 'social_long_video':
        return <SocialLongVideoForm asset={asset} content={content} />;
      case 'social_short_video':
        return <SocialShortVideoForm asset={asset} content={content} />;
      case 'social_quote_card':
        return <SocialQuoteCardForm asset={asset} />;
      default:
        // If the type is unknown, show the raw data
        return (
          <Card>
            <CardHeader>
              <CardTitle>
                Unsupported Asset Type: &quot;{asset.content_type}&quot;
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This asset type does not have a dedicated editor yet. You can
                view its data below.
              </p>
              <pre className="mt-4 rounded-md bg-muted p-4 text-xs">
                {JSON.stringify(asset, null, 2)}
              </pre>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Content Assets</h2>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Content'}
        </Button>
      </div>

      {isLoading && <p>Loading content assets...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && assets.length === 0 && (
        <p>No content assets found for this item.</p>
      )}

      {!isLoading &&
        !error &&
        assets.map(asset => (
          <div key={asset.id}>{renderAssetForm(asset)}</div>
        ))}
    </div>
  );
} 