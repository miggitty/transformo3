import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import ContentDetailClientPage from '@/components/shared/content-detail-client-page';

// Define props with an interface for clarity
interface ContentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContentDetailPage(props: ContentDetailPageProps) {
  // Await the params before accessing the id property (required in Next.js 15)
  const params = await props.params;
  const id = params.id;

  const supabase = await createClient();

  const { data: content } = await supabase
    .from('content')
    .select(`
      *, 
      businesses(
        *, 
        ai_avatar_integrations(
          id,
          secret_id,
          avatar_id,
          voice_id,
          status,
          provider
        )
      )
    `)
    .eq('id', id)
    .single();

  if (!content) {
    notFound();
  }

  return <ContentDetailClientPage content={content} />;
} 