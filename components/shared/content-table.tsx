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
import { PROJECT_TYPES, ProjectType } from '@/types/index';
import { Mic, Video } from 'lucide-react';

function formatStatus(status: string | null, projectType?: ProjectType) {
  if (!status) return 'Unknown';
  if (status === 'processing') {
    const processingText = projectType === 'video_upload' 
      ? 'Processing Video...' 
      : 'Processing Audio...';
    return (
      <div className="flex items-center">
        <span className="relative mr-2 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-sky-500"></span>
        </span>
        {processingText}
      </div>
    );
  }
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getProjectTypeDisplay(projectType: ProjectType | null) {
  if (!projectType) return null;
  
  const Icon = projectType === 'video_upload' ? Video : Mic;
  const label = PROJECT_TYPES[projectType] || projectType;
  
  return (
    <div className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      <span className="text-xs">{label}</span>
    </div>
  );
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
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created At</TableHead>
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
                    ? (item.project_type === 'video_upload' ? 'Processing Video...' : 'Processing Audio...')
                    : item.content_title || 'Untitled'}
                </TableCell>
                <TableCell>
                  {getProjectTypeDisplay(item.project_type as ProjectType)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === 'completed' ? 'default' : 'outline'
                    }
                  >
                    {formatStatus(item.status, item.project_type as ProjectType)}
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
              <TableCell colSpan={4} className="h-24 text-center">
                No content created yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
} 