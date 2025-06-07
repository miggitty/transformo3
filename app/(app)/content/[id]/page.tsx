import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import ContentDetailClientPage from '@/components/shared/content-detail-client-page';

export default async function ContentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const id = params.id;

  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('id', id)
    .single();

  if (!content) {
    notFound();
  }

  return <ContentDetailClientPage content={content} />;
} 