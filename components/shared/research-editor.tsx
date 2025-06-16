'use client';

import { useEffect, useState, useMemo } from 'react';
import { RichTextEditor } from '@/components/shared/rich-text-editor';
import { marked } from 'marked';

interface ResearchEditorProps {
  initialMarkdown: string;
  onContentChange: (newHtml: string) => void;
}

export default function ResearchEditor({
  initialMarkdown,
  onContentChange,
}: ResearchEditorProps) {
  const [htmlContent, setHtmlContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Marked.parse can return a promise
    Promise.resolve(marked.parse(initialMarkdown || '')).then(parsedHtml => {
      setHtmlContent(parsedHtml);
      setIsLoading(false);
    });
  }, [initialMarkdown]);

  if (isLoading) {
    return <p>Loading editor...</p>;
  }

  return (
    <div className="prose dark:prose-invert max-w-none">
      <RichTextEditor
        initialContent={htmlContent}
        onUpdate={onContentChange}
      />
    </div>
  );
} 