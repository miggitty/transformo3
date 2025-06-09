'use client';

import { useMemo, useState, useTransition } from 'react';
import { RichTextEditor } from '@/components/shared/rich-text-editor';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  updateContentField,
  generateContent,
} from '@/app/(app)/content/[id]/actions';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { ContentWithBusiness } from '@/types';

interface ResearchEditorProps {
  content: ContentWithBusiness;
}

const turndownService = new TurndownService();

export default function ResearchEditor({ content: contentProp }: ResearchEditorProps) {
  const initialHtml = useMemo(() => {
    if (!contentProp.research) return '';
    return marked.parse(contentProp.research) as string;
  }, [contentProp.research]);

  const [htmlContent, setHtmlContent] = useState(initialHtml);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGeneratingTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const markdown = turndownService.turndown(htmlContent);
      const { success, error } = await updateContentField({
        contentId: contentProp.id,
        fieldName: 'research',
        newValue: markdown,
      });

      if (success) {
        toast.success('Research has been updated.');
      } else {
        toast.error(error || 'An unknown error occurred.');
      }
    });
  };

  const handleGenerate = () => {
    startGeneratingTransition(async () => {
      if (!contentProp.businesses) {
        toast.error('Business information is missing.');
        return;
      }

      const researchMarkdown = turndownService.turndown(htmlContent);
      const { success, error } = await generateContent({
        contentId: contentProp.id,
        content_title: contentProp.content_title,
        transcript: contentProp.transcript,
        research: researchMarkdown,
        video_script: contentProp.video_script,
        keyword: contentProp.keyword,
        business_name: contentProp.businesses.business_name,
        website_url: contentProp.businesses.website_url,
        social_media_profiles: contentProp.businesses.social_media_profiles,
        social_media_integrations: contentProp.businesses.social_media_integrations,
        writing_style_guide: contentProp.businesses.writing_style_guide,
        cta_youtube: contentProp.businesses.cta_youtube,
        cta_email: contentProp.businesses.cta_email,
        first_name: contentProp.businesses.first_name,
        last_name: contentProp.businesses.last_name,
        cta_social_long: contentProp.businesses.cta_social_long,
        cta_social_short: contentProp.businesses.cta_social_short,
        booking_link: contentProp.businesses.booking_link,
        email_name_token: contentProp.businesses.email_name_token,
        email_sign_off: contentProp.businesses.email_sign_off,
        color_primary: contentProp.businesses.color_primary,
        color_secondary: contentProp.businesses.color_secondary,
        color_background: contentProp.businesses.color_background,
        color_highlight: contentProp.businesses.color_highlight,
      });

      if (success) {
        toast.success('Content generation started successfully!');
      } else {
        toast.error(error || 'Failed to start content generation.');
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Research</CardTitle>
        <Button onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Generating...' : 'Generate Content'}
        </Button>
      </CardHeader>
      <CardContent className="prose dark:prose-invert max-w-none">
        <RichTextEditor
          initialContent={htmlContent}
          onUpdate={(newContent) => setHtmlContent(newContent)}
        />
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  );
} 