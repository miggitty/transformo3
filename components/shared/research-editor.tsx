'use client';

import { useMemo, useState, useTransition } from 'react';
import { RichTextEditor } from '@/components/shared/rich-text-editor';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { updateContentField } from '@/app/(app)/content/[id]/actions';
import { marked } from 'marked';
import TurndownService from 'turndown';

interface ResearchEditorProps {
  contentId: string;
  initialContent: string | null;
}

const turndownService = new TurndownService();

export default function ResearchEditor({
  contentId,
  initialContent,
}: ResearchEditorProps) {
  const initialHtml = useMemo(() => {
    if (!initialContent) return '';
    return marked.parse(initialContent) as string;
  }, [initialContent]);

  const [content, setContent] = useState(initialHtml);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const markdown = turndownService.turndown(content);
      const { success, error } = await updateContentField({
        contentId,
        fieldName: 'research',
        newValue: markdown,
      });

      if (success) {
        toast.success('Research has been updated.');
      } else {
        toast.error(error || 'An unknown error occurred.');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Research</CardTitle>
      </CardHeader>
      <CardContent className="prose dark:prose-invert max-w-none">
        <RichTextEditor
          initialContent={content}
          onUpdate={(newContent) => setContent(newContent)}
        />
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  );
} 