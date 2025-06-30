import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AccessGate } from '@/components/shared/access-gate';
import { VideoUploadClient } from './video-upload-client';

export default function VideoUploadPage() {
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
          <CardTitle>Video Upload Project</CardTitle>
          <CardDescription>
            Upload a video file to start the content creation process. Your video will be transcribed and used to generate social media content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VideoUploadClient />
        </CardContent>
      </Card>
    </AccessGate>
  );
} 