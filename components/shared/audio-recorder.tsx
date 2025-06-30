'use client';

import { Button } from '@/components/ui/button';
import { Mic, StopCircle, UploadCloud, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  createContentRecord,
  finalizeContentRecord,
} from '@/app/(app)/voice-recording/actions';

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'uploading';

export function AudioRecorder() {
  const router = useRouter();
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permission, setPermission] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const getMicrophonePermission = async () => {
    if ('MediaRecorder' in window) {
      try {
        const streamData = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        setPermission(true);
        streamRef.current = streamData;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to get microphone permission';
        toast.error(message);
      }
    } else {
      toast.error('The MediaRecorder API is not supported in your browser.');
    }
  };

  const startRecording = async () => {
    if (!permission) {
      await getMicrophonePermission();
      return;
    }
    
    if (!streamRef.current) {
        toast.error("Microphone stream not available.");
        return;
    }

    setStatus('recording');
    
    try {
      const media = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
      mediaRecorder.current = media;
      
      audioChunksRef.current = [];
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.current.start();
    } catch (error) {
      console.error('Failed to start MediaRecorder:', error);
      toast.error('Failed to start recording.');
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    
    setStatus('processing');
    
    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setAudioBlob(audioBlob);
      audioChunksRef.current = [];
      setStatus('idle');
    };

    mediaRecorder.current.stop();
  };

  const handleUpload = async () => {
    if (!audioBlob) {
      toast.error('No audio to upload.');
      return;
    }

    setStatus('uploading');
    toast.info('Creating content record...');
    const createResult = await createContentRecord();

    if (!createResult || createResult.error || !createResult.data) {
      toast.error(createResult?.error || 'Failed to create content record.');
      setStatus('idle');
      return;
    }

    const { id: contentId, business_id: businessId } = createResult.data;
    const fileName = `${businessId}_${contentId}.webm`;
    
    toast.info('Uploading audio file...');
    
    // Use our new API route for uploading
    const formData = new FormData();
    formData.append('file', audioBlob, fileName);
    formData.append('businessId', businessId || '');
    formData.append('contentId', contentId || '');

    try {
      const response = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.info('Finalizing content...');
      const finalizeResult = await finalizeContentRecord(contentId, result.publicUrl);

      if (finalizeResult.error) {
        toast.error(finalizeResult.error);
      } else {
        toast.success('Content created successfully!');
        router.push('/content');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload audio file.';
      console.error('Upload error:', error);
      toast.error(message);
      setStatus('idle');
      return;
    }

    setStatus('idle');
    setAudioBlob(null);
  };

  // Auto-start recording after permission is granted (development convenience)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && permission && streamRef.current && status === 'idle' && !mediaRecorder.current) {
      startRecording();
    }
  }, [permission, status]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-muted p-12 text-center">
      {status === 'idle' && !audioBlob && (
        <>
          <Mic className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-xl font-semibold">Start Recording</h3>
          <p className="text-muted-foreground">
            Click the button below to start recording your audio.
          </p>
          <Button onClick={startRecording} size="lg">
            Record
          </Button>
        </>
      )}

      {status === 'recording' && (
        <>
          <Hourglass className="h-12 w-12 text-primary animate-spin" />
          <h3 className="text-xl font-semibold">Recording...</h3>
          <p className="text-2xl font-mono">{formatTime(timer)}</p>
          <Button onClick={stopRecording} size="lg" variant="destructive">
            <StopCircle className="mr-2 h-4 w-4" />
            Stop
          </Button>
        </>
      )}

      {audioBlob && status === 'idle' && (
        <>
          <UploadCloud className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-xl font-semibold">Ready to Upload</h3>
          <p className="text-muted-foreground">
            Your recording is ready. Click upload to create your content.
          </p>
          <div className="flex gap-4">
            <Button
              onClick={() => setAudioBlob(null)}
              variant="outline"
              size="lg"
            >
              Discard
            </Button>
            <Button onClick={handleUpload} size="lg">
              Upload
            </Button>
          </div>
        </>
      )}
      
      {status === 'uploading' && (
        <>
            <Hourglass className="h-12 w-12 text-primary animate-spin" />
            <h3 className="text-xl font-semibold">Uploading...</h3>
            <p className="text-muted-foreground">
                Please wait while we process your audio.
            </p>
        </>
      )}
    </div>
  );
} 