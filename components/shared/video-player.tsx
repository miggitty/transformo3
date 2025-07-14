'use client';

import { useRef } from 'react';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export function VideoPlayer({ src, className = '' }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={src}
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