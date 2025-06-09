'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AudioPlayer } from '@/components/shared/audio-player';
import dynamic from 'next/dynamic';
import { ContentWithBusiness } from '@/types';

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
  return (
    <div className="grid w-full max-w-4xl gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">
          {content.content_title}
        </h1>
      </div>

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
    </div>
  );
} 