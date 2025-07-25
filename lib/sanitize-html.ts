import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param dirty - The potentially unsafe HTML string
 * @param options - DOMPurify configuration options
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHTML(dirty: string, options?: DOMPurify.Config): string {
  // Only run DOMPurify on the client side
  if (typeof window === 'undefined') {
    // On server side, return empty string for safety
    // This prevents SSR issues while maintaining security
    return '';
  }
  
  // Default configuration allows common HTML tags but removes dangerous elements
  const defaultConfig: DOMPurify.Config = {
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'b', 'i', 'u', 'strong', 'em',
      'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr', 'sup', 'sub'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 'style',
      'src', 'alt', 'width', 'height', 'loading'
    ],
    ALLOW_DATA_ATTR: false,
    // Ensure links open in new tab with security
    ADD_ATTR: ['target', 'rel'],
    FORCE_BODY: true,
    RETURN_TRUSTED_TYPE: false
  };
  
  // Merge default config with user options
  const config = { ...defaultConfig, ...options };
  
  // Sanitize and return
  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitize HTML for rich text content (more permissive)
 * Used for blog posts, emails, etc.
 */
export function sanitizeRichHTML(dirty: string): string {
  return sanitizeHTML(dirty, {
    // Allow more tags for rich content
    ALLOWED_TAGS: [
      'p', 'br', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'b', 'i', 'u', 'strong', 'em',
      'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'img', 'hr', 'sup', 'sub', 'figure', 'figcaption', 'video', 'audio',
      'iframe', 'mark', 'ins', 'del', 's', 'small', 'big'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'id', 'style',
      'src', 'alt', 'width', 'height', 'loading', 'title',
      'controls', 'autoplay', 'loop', 'muted', 'poster',
      'frameborder', 'allowfullscreen', 'allow'
    ],
    // Only allow YouTube/Vimeo iframes
    ALLOWED_URI_REGEXP: /^(?:(?:https?:)?\/\/)?(?:www\.)?(?:youtube\.com|vimeo\.com|youtu\.be)\//i,
  });
}

/**
 * Sanitize plain text (removes all HTML)
 */
export function sanitizeText(dirty: string): string {
  if (typeof window === 'undefined') {
    // Simple server-side text sanitization
    return dirty.replace(/<[^>]*>/g, '').trim();
  }
  
  return DOMPurify.sanitize(dirty, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
}