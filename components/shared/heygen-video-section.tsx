'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { generateHeygenVideo } from '@/app/actions/settings';
import { ContentWithBusiness } from '@/types';
import { createClientSafe } from '@/utils/supabase/client';
import { Play, Loader2, Video, AlertCircle, RotateCcw } from 'lucide-react';

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

  const getStatusBadge = () => {
    switch (content.heygen_status) {
      case 'processing':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>;
      case 'completed':
        return <Badge variant="default" className="flex items-center gap-1">
          <Video className="h-3 w-3" />
          Completed
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>;
      default:
        return null;
    }
  };

  const canGenerate = content.video_script && 
                     heygenIntegration?.secret_id && 
                     heygenIntegration?.avatar_id && 
                     heygenIntegration?.voice_id &&
                     content.heygen_status !== 'processing';

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              AI Avatar Video
            </CardTitle>
            <CardDescription>
              Generate an AI avatar video from your video script using HeyGen.
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
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

        {/* Action Button */}
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
            {content.heygen_status === 'processing' ? 'Processing...' : 'Generate AI Video'}
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

        {/* Video Player */}
        {content.heygen_status === 'completed' && (content.heygen_url || content.video_long_url) && (
          <div className="space-y-2">
            <h4 className="font-medium">Generated Video:</h4>
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <video
                controls
                className="w-full h-full"
                src={content.heygen_url || content.video_long_url || undefined}
                onError={(e) => {
                  console.error('Video failed to load:', e);
                  toast.error('Video failed to load. Please check the URL.');
                }}
                onLoadStart={() => console.log('Video loading started')}
                onLoadedData={() => console.log('Video data loaded')}
              >
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="text-xs text-muted-foreground">
              Video URL: {content.heygen_url || content.video_long_url}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 