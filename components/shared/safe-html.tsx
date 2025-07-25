'use client';

import { useEffect, useState } from 'react';
import { sanitizeRichHTML } from '@/lib/sanitize-html';

interface SafeHtmlProps {
  html: string;
  className?: string;
}

export default function SafeHtml({ html, className }: SafeHtmlProps) {
  const [sanitizedHtml, setSanitizedHtml] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setSanitizedHtml(sanitizeRichHTML(html));
  }, [html]);

  // During SSR, render a div with the class but no content to prevent layout shift
  if (!isClient) {
    return <div className={className} style={{ minHeight: '1rem' }} />;
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}