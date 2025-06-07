import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AudioPlayer } from '@/components/shared/audio-player';
import { EditableField } from '@/components/shared/editable-field';

export default async function ContentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!content) {
    notFound();
  }

  return (
    <div className="grid w-full max-w-4xl gap-4 md:gap-8">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold md:text-3xl">
          {content.content_title}
        </h1>
      </div>

      {content.audio_url && (
        <Card>
          <CardHeader>
            <CardTitle>Original Audio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <AudioPlayer src={content.audio_url} />
              <span className="text-sm text-muted-foreground">
                Click to play the original recording.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <EditableField
        contentId={content.id}
        fieldName="transcript"
        title="Transcript"
        initialContent={content.transcript}
      />

      <EditableField
        contentId={content.id}
        fieldName="video_script"
        title="Video Script"
        initialContent={content.video_script}
      />

      <EditableField
        contentId={content.id}
        fieldName="research"
        title="Research"
        initialContent={content.research}
      />
    </div>
  );
} 