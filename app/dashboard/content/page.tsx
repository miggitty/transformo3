import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';
import { Tables } from '@/types/supabase';
import { Badge } from '@/components/ui/badge';

function formatStatus(status: string | null) {
  if (!status) return 'Unknown';
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default async function ContentPage() {
  const cookieStore = cookies();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user!.id)
    .single();

  const { data: content, error } = await supabase
    .from('content')
    .select('*')
    .eq('business_id', profile!.business_id!)
    .order('created_at', { ascending: false });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Content</CardTitle>
          <CardDescription>
            Manage and create new content for your business.
          </CardDescription>
        </div>
        <Link href="/dashboard/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Content
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {content && content.length > 0 ? (
              content.map((item: Tables<'content'>) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.content_title || 'Untitled'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatStatus(item.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(item.created_at!).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No content created yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
} 