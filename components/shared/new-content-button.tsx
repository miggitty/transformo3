'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Mic, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PROJECT_TYPES } from '@/types/index';

interface NewContentButtonProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function NewContentButton({ 
  variant = 'default', 
  size = 'default',
  className = '' 
}: NewContentButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleVoiceRecording = () => {
    router.push('/voice-recording');
    setIsOpen(false);
  };

  const handleVideoUpload = () => {
    router.push('/video-upload');
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={`flex items-center justify-between ${className}`}
        >
          New Content
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[200px]">
        <DropdownMenuItem 
          onClick={handleVoiceRecording}
          className="flex items-center gap-3 cursor-pointer"
        >
          <Mic className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">{PROJECT_TYPES.voice_recording}</span>
            <span className="text-xs text-muted-foreground">Record audio to create content</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleVideoUpload}
          className="flex items-center gap-3 cursor-pointer"
        >
          <Video className="h-4 w-4" />
          <div className="flex flex-col">
            <span className="font-medium">{PROJECT_TYPES.video_upload}</span>
            <span className="text-xs text-muted-foreground">Upload video to create content</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 