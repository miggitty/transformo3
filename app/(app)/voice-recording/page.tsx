import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AudioRecorder } from '@/components/shared/audio-recorder';
import { AccessGate } from '@/components/shared/access-gate';

export default function VoiceRecordingPage() {
  return (
    <AccessGate 
      feature="content creation"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content creation requires an active subscription.
          </p>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Voice Recording Project</CardTitle>
          <CardDescription>
            Record an audio clip to start the content creation process. Your voice recording will be transcribed and used to generate social media content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AudioRecorder />
        </CardContent>
      </Card>
    </AccessGate>
  );
} 