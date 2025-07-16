import { useState, useEffect, useCallback } from 'react';
import { createClientSafe } from '@/utils/supabase/client';
import { ContentWithBusiness } from '@/types';

export interface VideoGenerationState {
  status: 'idle' | 'starting' | 'processing' | 'completed' | 'failed' | 'timeout';
  progress: number; // 0-100
  estimatedTimeRemaining?: number; // seconds
  errorMessage?: string;
  errorType?: 'network' | 'api' | 'timeout' | 'quota' | 'unknown';
  retryCount: number;
  maxRetries: number;
  startTime?: number;
}

interface UseVideoGenerationOptions {
  contentId: string;
  videoType: 'long' | 'short';
  onVideoUpdated?: (videoUrl: string) => void;
  onGenerationComplete?: () => void;
  onError?: (error: VideoGenerationState['errorType'], message: string) => void;
}

export function useVideoGeneration({
  contentId,
  videoType,
  onVideoUpdated,
  onGenerationComplete,
  onError
}: UseVideoGenerationOptions) {
  const [state, setState] = useState<VideoGenerationState>({
    status: 'idle',
    progress: 0,
    retryCount: 0,
    maxRetries: 3
  });

  const supabase = createClientSafe();

  // Check database status on mount to restore state persistence
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const { data: content } = await supabase
          .from('content')
          .select('heygen_status')
          .eq('id', contentId)
          .single();

        if (content?.heygen_status === 'processing') {
          setState(prev => ({
            ...prev,
            status: 'processing',
            progress: 20, // Show some progress to indicate it's running
            startTime: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error checking initial video generation status:', error);
      }
    };

    checkInitialStatus();
  }, [contentId, supabase]);

  const handleStatusUpdate = useCallback((updatedContent: ContentWithBusiness) => {
    const { heygen_status, video_long_url, video_short_url } = updatedContent;
    const currentVideoUrl = videoType === 'long' ? video_long_url : video_short_url;

    console.log('Processing status update:', { heygen_status, videoType, currentVideoUrl });

    setState(prev => {
      // ✅ FIXED: Don't ignore updates based on current state - process all heygen_status changes
      switch (heygen_status) {
        case 'completed':
          if (currentVideoUrl) {
            console.log('Video generation completed, updating URL:', currentVideoUrl);
            onVideoUpdated?.(currentVideoUrl);
            onGenerationComplete?.();
            return {
              ...prev,
              status: 'completed',
              progress: 100,
              estimatedTimeRemaining: 0
            };
          }
          break;
        
        case 'failed':
          console.log('Video generation failed');
          onError?.('api', 'AI video generation failed');
          return {
            ...prev,
            status: 'failed',
            errorType: 'api',
            errorMessage: 'AI video generation failed'
          };
        
        case 'processing':
          // Only update to processing if we're not already completed
          if (prev.status !== 'completed') {
            console.log('Video generation in progress');
            return {
              ...prev,
              status: 'processing',
              progress: Math.max(prev.progress, 20) // Ensure some progress is shown
            };
          }
          break;
      }

      return prev;
    });
  }, [videoType, onVideoUpdated, onGenerationComplete, onError]);

  // Progress simulation for better UX
  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    
    if (state.status === 'processing') {
      progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.status !== 'processing') return prev;
          
          const elapsed = Date.now() - (prev.startTime || Date.now());
          const estimatedTotal = 180000; // 3 minutes estimated
          const progressFromTime = Math.min((elapsed / estimatedTotal) * 80, 80); // Max 80% from time
          
          return {
            ...prev,
            progress: Math.max(prev.progress, progressFromTime),
            estimatedTimeRemaining: Math.max(0, Math.ceil((estimatedTotal - elapsed) / 1000))
          };
        });
      }, 2000);
    }

    return () => {
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [state.status, state.startTime]);

  // Real-time subscription with enhanced error handling
  useEffect(() => {
    const subscription = supabase
      .channel(`video-generation-${contentId}-${videoType}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'content',
        filter: `id=eq.${contentId}`
      }, (payload) => {
        console.log('Real-time update received:', payload.new);
        const updatedContent = payload.new as ContentWithBusiness;
        handleStatusUpdate(updatedContent);
      })
      .subscribe((status: string) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [contentId, videoType, handleStatusUpdate, supabase]);

  // Timeout handling
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (state.status === 'processing') {
      timeoutId = setTimeout(() => {
        setState(prev => ({
          ...prev,
          status: 'timeout',
          errorType: 'timeout',
          errorMessage: 'Video generation took longer than expected'
        }));
        onError?.('timeout', 'Video generation took longer than expected');
      }, 300000); // 5 minute timeout
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [state.status, onError]);

  const startGeneration = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'starting',
      progress: 0,
      startTime: Date.now(),
      errorMessage: undefined,
      errorType: undefined
    }));

    // Quick transition to processing to show immediate feedback
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        status: 'processing',
        progress: 10
      }));
    }, 500);
  }, []);

  const retryGeneration = useCallback(() => {
    setState(prev => {
      if (prev.retryCount >= prev.maxRetries) {
        return prev;
      }

      return {
        ...prev,
        status: 'idle',
        progress: 0,
        retryCount: prev.retryCount + 1,
        errorMessage: undefined,
        errorType: undefined
      };
    });
  }, []);

  const resetGeneration = useCallback(() => {
    setState({
      status: 'idle',
      progress: 0,
      retryCount: 0,
      maxRetries: 3
    });
  }, []);

  const canRetry = state.retryCount < state.maxRetries;
  const isGenerating = state.status === 'starting' || state.status === 'processing';

  return {
    state,
    isGenerating,
    canRetry,
    startGeneration,
    retryGeneration,
    resetGeneration
  };
} 