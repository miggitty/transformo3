'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AudioPlayer } from '@/components/shared/audio-player';
import dynamic from 'next/dynamic';
import { ContentWithBusiness, ContentAsset } from '@/types';
import { useEffect, useState, useTransition } from 'react';
import { createClient } from '@/utils/supabase/client';
import ContentAssetsManager from './content-assets-manager';
import VideoUploadSection from './video-upload-section';
import {
  updateContentField,
  generateContent,
} from '@/app/(app)/content/[id]/actions';
import { toast } from 'sonner';
import TurndownService from 'turndown';
import { Button } from '@/components/ui/button';

const ResearchEditor = dynamic(
  () => import('@/components/shared/research-editor'),
  {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
  }
);

const turndownService = new TurndownService();

interface ContentDetailClientPageProps {
  content: ContentWithBusiness;
}

export default function ContentDetailClientPage({
  content: initialContent,
}: ContentDetailClientPageProps) {
  const [content, setContent] = useState<ContentWithBusiness>(initialContent);
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const supabase = createClient();

  const [researchHtml, setResearchHtml] = useState('');
  const [isSaving, startSaveTransition] = useTransition();
  const [isGenerating, startGeneratingTransition] = useTransition();

  const handleSaveResearch = () => {
    startSaveTransition(async () => {
      const markdown = turndownService.turndown(researchHtml);
      const { success, error } = await updateContentField({
        contentId: content.id,
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

  const handleGenerateContent = () => {
    startGeneratingTransition(async () => {
      if (!content.businesses) {
        toast.error('Business information is missing.');
        return;
      }

      const researchMarkdown = turndownService.turndown(researchHtml);
      const { success, error } = await generateContent({
        contentId: content.id,
        content_title: content.content_title,
        transcript: content.transcript,
        research: researchMarkdown,
        video_script: content.video_script,
        keyword: content.keyword,
        business_name: content.businesses.business_name,
        website_url: content.businesses.website_url,
        social_media_profiles: content.businesses.social_media_profiles,
        social_media_integrations:
          content.businesses.social_media_integrations,
        writing_style_guide: content.businesses.writing_style_guide,
        cta_youtube: content.businesses.cta_youtube,
        cta_email: content.businesses.cta_email,
        first_name: content.businesses.first_name,
        last_name: content.businesses.last_name,
        cta_social_long: content.businesses.cta_social_long,
        cta_social_short: content.businesses.cta_social_short,
        booking_link: content.businesses.booking_link,
        email_name_token: content.businesses.email_name_token,
        email_sign_off: content.businesses.email_sign_off,
        color_primary: content.businesses.color_primary,
        color_secondary: content.businesses.color_secondary,
        color_background: content.businesses.color_background,
        color_highlight: content.businesses.color_highlight,
      });

      if (success) {
        toast.success('Content generation started successfully!');
      } else {
        toast.error(error || 'Failed to start content generation.');
      }
    });
  };

  const fetchContentAssets = async () => {
    const { data, error: fetchError } = await supabase
      .from('content_assets')
      .select('*')
      .eq('content_id', content.id);

    if (fetchError) {
      console.error('Error fetching content assets:', fetchError);
      setError('Failed to load content assets.');
    } else {
      console.log('Fetched content assets:', data);
      setContentAssets(data);
    }
  };

  const handleVideoUpdate = (videoType: 'long' | 'short', videoUrl: string | null) => {
    setContent(prev => ({
      ...prev,
      [videoType === 'long' ? 'video_long_url' : 'video_short_url']: videoUrl,
    }));
  };

  useEffect(() => {
    const checkPermissionsAndFetch = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .single();

        if (profile && profile.business_id !== content.business_id) {
          setPermissionError(true);
          setIsLoading(false);
          return;
        }
      }

      await fetchContentAssets();
      setIsLoading(false);
    };

    checkPermissionsAndFetch();
  }, [content.id, content.business_id, supabase]);

  return (
    <div className="flex w-full flex-col gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">
          {content.content_title}
        </h1>
      </div>

      {permissionError && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <h3 className="font-semibold text-destructive">Permission Denied</h3>
          <p className="text-sm text-destructive">
            You do not have permission to view or edit the assets for this
            content because it belongs to a different business.
          </p>
        </div>
      )}

      {content.audio_url && (
        <Accordion type="single" collapsible className="w-full rounded-lg border">
          <AccordionItem value="audio" className="border-b-0">
            <AccordionTrigger className="px-4 text-lg font-semibold">
              Original Audio
            </AccordionTrigger>
            <AccordionContent className="px-4">
              <div className="flex items-center gap-4 pt-4">
                <AudioPlayer src={content.audio_url} />
                <span className="text-sm text-muted-foreground">
                  Click to play the original recording.
                </span>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <Accordion type="single" collapsible className="w-full rounded-lg border">
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="px-4 text-lg font-semibold">
            Transcript
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: content.transcript || '<p>No transcript available.</p>',
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible className="w-full rounded-lg border">
        <AccordionItem value="video-script" className="border-b-0">
          <AccordionTrigger className="px-4 text-lg font-semibold">
            Video Script
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html:
                  content.video_script ||
                  '<p>No video script has been generated yet.</p>',
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible className="w-full rounded-lg border">
        <AccordionItem value="research" className="border-b-0">
          <AccordionTrigger className="px-4 text-lg font-semibold">
            Research
          </AccordionTrigger>
          <AccordionContent className="px-4">
            <ResearchEditor
              initialMarkdown={content.research || ''}
              onContentChange={setResearchHtml}
            />
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveResearch} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Research'}
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {!permissionError && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Social Media Videos</h2>
          </div>
          <VideoUploadSection
            content={content}
            onVideoUpdate={handleVideoUpdate}
          />
        </div>
      )}

      {!permissionError && (
              <ContentAssetsManager
        assets={contentAssets}
        content={content}
        isLoading={isLoading}
        error={error}
        onGenerate={handleGenerateContent}
        isGenerating={isGenerating}
        onRefresh={fetchContentAssets}
        onAssetUpdate={(updatedAsset: ContentAsset) => {
          setContentAssets(prev => 
            prev.map(asset => 
              asset.id === updatedAsset.id ? updatedAsset : asset
            )
          );
        }}
      />
      )}
    </div>
  );
} 