import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AudioRecorder } from '@/components/shared/audio-recorder';

export default function NewContentPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Content</CardTitle>
        <CardDescription>
          Record an audio clip to start the content creation process.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AudioRecorder />
      </CardContent>
    </Card>
  );
} 