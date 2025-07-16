'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { generateHeygenVideo } from '@/app/actions/settings';
import { ContentWithBusiness } from '@/types';
import { createClientSafe } from '@/utils/supabase/client';
import { Play, Loader2, Video, AlertCircle, RotateCcw } from 'lucide-react';
import { VideoPlayer } from './video-player';

interface HeygenVideoSectionProps {
  content: ContentWithBusiness;
  onContentUpdate: (updatedContent: Partial<ContentWithBusiness>) => void;
}

export function HeygenVideoSection({ content, onContentUpdate }: HeygenVideoSectionProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const supabase = createClientSafe();

  // Set up real-time subscription for status updates
  useEffect(() => {
    const channel = supabase
      .channel('content-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'content',
        filter: `id=eq.${content.id}`,
      }, (payload) => {
        const updatedContent = payload.new as ContentWithBusiness;
        onContentUpdate({
          heygen_status: updatedContent.heygen_status,
          heygen_video_id: updatedContent.heygen_video_id,
          video_long_url: updatedContent.video_long_url,
        });

        // Show notification when video is complete
        if (updatedContent.heygen_status === 'completed' && content.heygen_status !== 'completed') {
          toast.success('AI Avatar video generation completed!');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [content.id, content.heygen_status, onContentUpdate, supabase]);

  // Get HeyGen integration data
  const heygenIntegration = content.businesses?.ai_avatar_integrations?.find(
    integration => integration.provider === 'heygen' && integration.status === 'active'
  );

  const handleGenerateVideo = async () => {
    if (!content.video_script) {
      toast.error('Video script is required to generate an AI avatar video.');
      return;
    }

    if (!heygenIntegration?.secret_id) {
      toast.error('HeyGen API key is not configured. Please set it up in Settings.');
      return;
    }

    if (!heygenIntegration?.avatar_id || !heygenIntegration?.voice_id) {
      toast.error('HeyGen avatar and voice IDs are required. Please configure them in Settings.');
      return;
    }

    setIsGenerating(true);
    
    const result = await generateHeygenVideo(
      content.business_id!,
      content.id,
      content.video_script
    );

    if (result.error) {
      toast.error('Failed to start video generation', { description: result.error });
    } else {
      toast.success('AI avatar video generation started!');
      onContentUpdate({ heygen_status: 'processing' });
    }

    setIsGenerating(false);
  };

  const handleResetStatus = async () => {
    const { error } = await supabase
      .from('content')
      .update({
        heygen_status: null,
        heygen_video_id: null,
        heygen_url: null
      })
      .eq('id', content.id);

    if (error) {
      toast.error('Failed to reset status', { description: error.message });
    } else {
      toast.success('Status reset successfully');
      onContentUpdate({ 
        heygen_status: null, 
        heygen_video_id: null, 
        heygen_url: null 
      });
    }
  };

  const canGenerate = content.video_script && 
                     heygenIntegration?.secret_id && 
                     heygenIntegration?.avatar_id && 
                     heygenIntegration?.voice_id &&
                     content.heygen_status !== 'processing';

  const hasGeneratedVideo = content.heygen_status === 'completed' && (content.heygen_url || content.video_long_url);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          AI Avatar Video
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasGeneratedVideo ? (
          <div className="space-y-4">
            <VideoPlayer src={content.heygen_url || content.video_long_url || ''} />
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateVideo}
                disabled={!canGenerate || isGenerating}
                variant="outline"
                className="flex-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Generate New Video
              </Button>
              {/* Reset Button for Development/Testing */}
              {(content.heygen_status === 'processing' || content.heygen_status === 'failed') && (
                <Button 
                  onClick={handleResetStatus}
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Display */}
            {content.heygen_status === 'processing' && (
              <div className="flex items-center justify-center py-8 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-primary/10 rounded-full p-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Generating AI Avatar Video...
                  </Badge>
                </div>
              </div>
            )}

            {content.heygen_status === 'failed' && (
              <div className="flex items-center justify-center py-8 space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-destructive/10 rounded-full p-4">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Generation Failed
                  </Badge>
                </div>
              </div>
            )}

            {!content.heygen_status && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Video className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                  No AI avatar video generated yet
                </p>
              </div>
            )}

            {/* Configuration Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>HeyGen API Key:</span>
                <Badge variant={heygenIntegration?.secret_id ? "default" : "secondary"}>
                  {heygenIntegration?.secret_id ? "Configured" : "Not Set"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Avatar ID:</span>
                <Badge variant={heygenIntegration?.avatar_id ? "default" : "secondary"}>
                  {heygenIntegration?.avatar_id ? "Set" : "Not Set"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Voice ID:</span>
                <Badge variant={heygenIntegration?.voice_id ? "default" : "secondary"}>
                  {heygenIntegration?.voice_id ? "Set" : "Not Set"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Video Script:</span>
                <Badge variant={content.video_script ? "default" : "secondary"}>
                  {content.video_script ? "Available" : "Not Generated"}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-4">
              <Button 
                onClick={handleGenerateVideo}
                disabled={!canGenerate || isGenerating}
                className="flex items-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Generate AI Video
              </Button>
              
              {/* Reset Button for Development/Testing */}
              {(content.heygen_status === 'processing' || content.heygen_status === 'failed') && (
                <Button 
                  onClick={handleResetStatus}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              )}
            </div>

            {/* Help Text */}
            {!canGenerate && content.video_script && (
              <p className="text-sm text-muted-foreground">
                Configure HeyGen settings to enable video generation.
              </p>
            )}
            
            {!content.video_script && (
              <p className="text-sm text-muted-foreground">
                Generate a video script first to create an AI avatar video.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 