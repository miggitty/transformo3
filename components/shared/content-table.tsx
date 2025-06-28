'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tables } from '@/types/supabase';
import { RealtimeContentUpdater } from './realtime-content-updater';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

function formatStatus(status: string | null) {
  if (!status) return 'Unknown';
  if (status === 'processing') {
    return (
      <div className="flex items-center">
        <span className="relative mr-2 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500"></span>
        </span>
        Still Process Content...
      </div>
    );
  }
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function ContentTable({
  serverContent,
  businessId,
}: {
  serverContent: Tables<'content'>[];
  businessId: string;
}) {
  const [content, setContent] = useState(serverContent);
  const router = useRouter();

  // This effect ensures that if the server-provided content changes (e.g., due to navigation),
  // the client-side state is updated to match.
  useEffect(() => {
    setContent(serverContent);
  }, [serverContent]);

  return (
    <>
      <RealtimeContentUpdater
        businessId={businessId}
        serverContent={content}
        onUpdate={setContent}
      />
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
            content.map((item) => (
              <TableRow
                key={item.id}
                onDoubleClick={() => router.push(`/content/${item.id}`)}
                className="cursor-pointer"
              >
                <TableCell className="font-medium">
                  {item.status === 'processing'
                    ? 'Currently Processing Audio...'
                    : item.content_title || 'Untitled'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === 'completed' ? 'default' : 'outline'
                    }
                  >
                    {formatStatus(item.status)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {new Date(item.created_at || Date.now()).toLocaleDateString(
                    'en-AU',
                    {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }
                  )}
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
    </>
  );
} 