'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export function VideoPlayer({ src, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayClick = () => {
    if (!videoLoaded) {
      setIsLoading(true);
      setVideoLoaded(true);
    }
  };

  const handleVideoLoadedData = () => {
    setIsLoading(false);
    // Auto-play once the video is loaded
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  return (
    <div className={`relative ${className}`}>
      {!videoLoaded ? (
        // Placeholder with play button
        <div 
          className="w-full rounded-lg shadow-sm border bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
          style={{ aspectRatio: '16/9' }}
          onClick={handlePlayClick}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="bg-primary/10 hover:bg-primary/20 rounded-full p-4 transition-colors">
              <Play className="h-8 w-8 text-primary ml-1" />
            </div>
            <span className="text-sm text-muted-foreground">Click to load and play video</span>
          </div>
        </div>
      ) : (
        // Actual video element
        <>
          {isLoading && (
            <div 
              className="absolute inset-0 bg-muted/50 flex items-center justify-center rounded-lg z-10"
            >
              <div className="bg-background/80 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm">Loading video...</span>
                </div>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            className="w-full rounded-lg shadow-sm border"
            style={{ aspectRatio: '16/9' }}
            onLoadedData={handleVideoLoadedData}
          >
            Your browser does not support the video tag.
          </video>
        </>
      )}
    </div>
  );
} 