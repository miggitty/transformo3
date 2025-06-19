import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { createClient } from '@/utils/supabase/server';
import { ContentTable } from '@/components/shared/content-table';

export default async function ContentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>You must be logged in to view this page.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  const businessId = profile?.business_id;

  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .eq('business_id', businessId || '')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content:', error);
    return <div>Error loading content.</div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Content List 260</CardTitle>
          <CardDescription>
            Manage and create new content for your business.
          </CardDescription>
        </div>
        <Link href="/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <ContentTable
          serverContent={content || []}
          businessId={businessId || ''}
        />
      </CardContent>
    </Card>
  );
} 