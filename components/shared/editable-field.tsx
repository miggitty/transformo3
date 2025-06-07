'use client';

import { useState, useTransition } from 'react';
import { RichTextEditor } from './rich-text-editor';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { updateContentField } from '@/app/(app)/content/[id]/actions';

type FieldName = 'transcript' | 'research' | 'video_script';

interface EditableFieldProps {
  contentId: string;
  fieldName: FieldName;
  title: string;
  initialContent: string | null;
}

export function EditableField({
  contentId,
  fieldName,
  title,
  initialContent,
}: EditableFieldProps) {
  const [content, setContent] = useState(initialContent || '');
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const { success, error } = await updateContentField({
        contentId,
        fieldName,
        newValue: content,
      });

      if (success) {
        toast.success(`${title} has been updated.`);
      } else {
        toast.error(error || 'An unknown error occurred.');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
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