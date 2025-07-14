'use client';

import { useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export function VideoPlayer({ src, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Add cache busting to ensure we get the latest version
  const getCacheBustedVideoUrl = (url: string): string => {
    if (!url) return '';
    
    // Add cache busting parameter to force browser to reload video
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${Date.now()}`;
  };

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        key={src} // Force re-render when src changes
        src={getCacheBustedVideoUrl(src)}
        controls
        preload="metadata"
        className="w-full rounded-lg shadow-sm border"
        style={{ aspectRatio: '16/9' }}
      >
        Your browser does not support the video tag.
      </video>
    </div>
  );
} 