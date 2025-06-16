'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Initialize the audio element only on the client side
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(src);
      setHasError(false);

      // Event listeners
      const handleEnded = () => {
        setIsPlaying(false);
      };
      
      const handleError = (e: Event) => {
        const audio = e.target as HTMLAudioElement;
        
        // Only log errors in development
        if (process.env.NODE_ENV === 'development') {
          console.error('AudioPlayer: Audio error:', {
            error: audio.error,
            errorCode: audio.error?.code,
            src: audio.src
          });
        }
        
        setHasError(true);
        setIsPlaying(false);
        setIsLoading(false);
        toast.error('Failed to load audio file');
      };
      
      const handleLoadStart = () => {
        setIsLoading(true);
      };
      
      const handleCanPlay = () => {
        setIsLoading(false);
      };

      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
      audioRef.current.addEventListener('loadstart', handleLoadStart);
      audioRef.current.addEventListener('canplay', handleCanPlay);

      // Cleanup
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.removeEventListener('error', handleError);
          audioRef.current.removeEventListener('loadstart', handleLoadStart);
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
  }, [src]);

  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('AudioPlayer: Play error:', error);
      }
      setHasError(true);
      setIsPlaying(false);
      setIsLoading(false);
      toast.error('Failed to play audio');
    }
  };

  if (hasError) {
    return (
      <Button variant="outline" size="icon" disabled>
        <AlertCircle className="h-4 w-4 text-destructive" />
      </Button>
    );
  }

  return (
    <Button 
      onClick={togglePlayPause} 
      variant="outline" 
      size="icon"
      disabled={isLoading}
    >
      {isLoading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : isPlaying ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );
} 