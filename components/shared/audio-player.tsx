'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    // Initialize the audio element only on the client side
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(src);

      // Event listener to reset playing state when audio finishes
      const handleEnded = () => setIsPlaying(false);
      audioRef.current.addEventListener('ended', handleEnded);

      // Cleanup
      return () => {
        audioRef.current?.removeEventListener('ended', handleEnded);
        // Pause and nullify the src to stop any ongoing playback and download
        audioRef.current?.pause();
        audioRef.current = null;
      };
    }
  }, [src]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <Button onClick={togglePlayPause} variant="outline" size="icon">
      {isPlaying ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );
} 