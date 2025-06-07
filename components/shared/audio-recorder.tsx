'use client';

import { Button } from '@/components/ui/button';
import { Mic, StopCircle, UploadCloud, Hourglass } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import {
  createContentRecord,
  finalizeContentRecord,
} from '@/app/(app)/new/actions';
import { useSupabaseBrowser } from '../providers/supabase-provider';

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'uploading';

export function AudioRecorder() {
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permission, setPermission] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
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
        setStream(streamData);
      } catch (err: any) {
        toast.error(err.message);
      }
    } else {
      toast.error('The MediaRecorder API is not supported in your browser.');
    }
  };

  const startRecording = async () => {
    if (!permission || !stream) {
      await getMicrophonePermission();
      // Need to re-trigger after getting permission
      return;
    }
    setStatus('recording');
    const media = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.current = media;
    mediaRecorder.current.start();
    let localAudioChunks: Blob[] = [];
    mediaRecorder.current.ondataavailable = (event) => {
      if (typeof event.data === 'undefined') return;
      if (event.data.size === 0) return;
      localAudioChunks.push(event.data);
    };
    setAudioChunks(localAudioChunks);
  };

  const stopRecording = () => {
    if (!mediaRecorder.current) return;
    setStatus('processing');
    mediaRecorder.current.stop();
    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      setAudioBlob(audioBlob);
      setAudioChunks([]);
      setStatus('idle');
    };
  };

  const handleUpload = async () => {
    if (!audioBlob) {
      toast.error('No audio to upload.');
      return;
    }

    setStatus('uploading');
    toast.info('Creating content record...');
    const createResult = await createContentRecord();

    if (createResult.error || !createResult.data) {
      toast.error(createResult.error || 'Failed to create content record.');
      setStatus('idle');
      return;
    }

    const { id: contentId, business_id: businessId } = createResult.data;
    const fileName = `${businessId}_${contentId}.webm`;
    
    toast.info('Uploading audio file...');
    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioBlob);

    if (uploadError) {
      toast.error(uploadError.message);
      setStatus('idle');
      return;
    }

    toast.info('Finalizing content...');
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('audio')
      .createSignedUrl(fileName, 31536000); // Expires in 1 year

    if (signedUrlError) {
      toast.error(signedUrlError.message);
      setStatus('idle');
      return;
    }

    const finalizeResult = await finalizeContentRecord(
      contentId,
      signedUrlData.signedUrl,
    );

    if (finalizeResult.error) {
      toast.error(finalizeResult.error);
    } else {
      toast.success('Content created successfully!');
      router.push('/content');
    }

    setStatus('idle');
    setAudioBlob(null);
  };

  useEffect(() => {
    // Automatically trigger startRecording after permission is granted
    if (permission && stream && status === 'idle' && mediaRecorder.current === null) {
      startRecording();
    }
  }, [permission, stream, status]);

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