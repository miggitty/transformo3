'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { ContentWithBusiness, ContentAsset } from '@/types';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import ContentAssetsManager from './content-assets-manager';
import VideoUploadSection from './video-upload-section';
import { HeygenVideoSection } from './heygen-video-section';
import { toast } from 'sonner';

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
  const [isContentGenerating, setIsContentGenerating] = useState(false);
  
  // Create stable supabase reference to avoid useEffect re-runs
  const supabase = createClient();

  const fetchContentAssets = useCallback(async () => {
    if (!supabase) {
      setError('Database connection unavailable.');
      return;
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
  }, [supabase, content.id]);

  const handleVideoUpdate = (videoType: 'long' | 'short', videoUrl: string | null) => {
    setContent(prev => ({
      ...prev,
      [videoType === 'long' ? 'video_long_url' : 'video_short_url']: videoUrl,
    }));
  };

  const handleContentUpdate = (updatedFields: Partial<ContentWithBusiness>) => {
    setContent(prev => ({
      ...prev,
      ...updatedFields,
    }));
  };

  // TEMPORARILY DISABLED - Real-time subscriptions to isolate infinite loop issue
  // TODO: Re-enable after fixing the root cause
  /*
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('content-updates').subscribe();
    return () => supabase.removeChannel(channel);
  }, []);
  */

  useEffect(() => {
    const checkPermissionsAndFetch = async () => {
      if (!supabase) {
        setError('Database connection unavailable.');
        setIsLoading(false);
        return;
      }

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

      // Fetch initial data directly without using callbacks to avoid dependencies
      try {
        // Fetch content status
        const { data: contentData } = await supabase
          .from('content')
          .select('content_generation_status')
          .eq('id', content.id)
          .single();
        
        if (contentData?.content_generation_status === 'generating') {
          setIsContentGenerating(true);
        }

        // Fetch content assets
        const { data: assetsData } = await supabase
          .from('content_assets')
          .select('*')
          .eq('content_id', content.id);
        
        if (assetsData) {
          setContentAssets(assetsData);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }

      setIsLoading(false);
    };

    checkPermissionsAndFetch();
  }, []); // Empty dependency array to run only once

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // Start polling when content generation is active
    if (isContentGenerating && supabase) {
      pollInterval = setInterval(async () => {
        try {
          const { data } = await supabase
            .from('content')
            .select('content_generation_status, content_title, transcript, video_script')
            .eq('id', content.id)
            .single();

          if (data) {
            const isGenerating = data.content_generation_status === 'generating';
            
            // If generation completed or failed, stop polling
            if (!isGenerating) {
              setIsContentGenerating(false);
              
              // Update content if changed
              setContent(prev => ({
                ...prev,
                content_title: data.content_title || prev.content_title,
                transcript: data.transcript || prev.transcript,
                video_script: data.video_script || prev.video_script,
              }));

              // Show completion message
              if (data.content_generation_status === 'completed') {
                toast.success('Content generation completed successfully!');
                // Refresh content assets
                if (fetchContentAssets) {
                  await fetchContentAssets();
                }
              } else if (data.content_generation_status === 'failed') {
                toast.error('Content generation failed. Please try again.');
              }
            }
          }
        } catch (error) {
          console.error('Error polling content status:', error);
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isContentGenerating, supabase, content.id, fetchContentAssets]);

  // TEMPORARILY DISABLED - Overlay that might be causing Radix UI issues
  // const showGeneratingOverlay = isContentGenerating || isGenerating;

  return (
    <>
      {/* DISABLED - Content Generation Overlay to isolate infinite loop issue */}

      <div className="flex w-full flex-col gap-4 md:gap-8">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold md:text-3xl">
            {content.content_title}
          </h1>
          {isContentGenerating && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-800"></div>
              Generating...
            </div>
          )}
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

        {!permissionError && (
          <HeygenVideoSection 
            content={content} 
            onContentUpdate={handleContentUpdate}
          />
        )}

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
    </>
  );
} 