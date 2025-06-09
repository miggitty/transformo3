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
import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import ContentAssetsManager from './content-assets-manager';

const ResearchEditor = dynamic(
  () => import('@/components/shared/research-editor'),
  {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
  }
);

interface ContentDetailClientPageProps {
  content: ContentWithBusiness;
}

export default function ContentDetailClientPage({
  content,
}: ContentDetailClientPageProps) {
  const [contentAssets, setContentAssets] = useState<ContentAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const supabase = createClient();

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

      const { data, error: fetchError } = await supabase
        .from('content_assets')
        .select('*')
        .eq('content_id', content.id);

      if (fetchError) {
        console.error('Error fetching content assets:', fetchError);
        setError('Failed to load content assets.');
      } else {
        setContentAssets(data);
      }
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
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="audio">
            <AccordionTrigger className="text-lg font-semibold">
              Original Audio
            </AccordionTrigger>
            <AccordionContent>
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

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger className="text-lg font-semibold">
            Transcript
          </AccordionTrigger>
          <AccordionContent>
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: content.transcript || '<p>No transcript available.</p>',
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="video-script">
          <AccordionTrigger className="text-lg font-semibold">
            Video Script
          </AccordionTrigger>
          <AccordionContent>
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

      <ResearchEditor content={content} />

      {!permissionError && (
        <ContentAssetsManager
          assets={contentAssets}
          content={content}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  );
} 