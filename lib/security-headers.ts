import { NextResponse } from 'next/server';

/**
 * Apply security headers to a response
 * @param response - The NextResponse object to add headers to
 * @param isDevelopment - Whether the app is running in development mode
 * @returns The response with security headers applied
 */
export function applySecurityHeaders(response: NextResponse, isDevelopment: boolean = false) {
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Limit browser features (allow microphone for voice recording functionality)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=()'
  );
  
  // XSS Protection (for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  // Note: This is a restrictive policy. Adjust based on your needs.
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://js.stripe.com https://checkout.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://www.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://checkout.stripe.com https://*.ingest.sentry.io",
    "media-src 'self' blob: https://*.supabase.co",
    "object-src 'none'",
    "child-src 'self' https://js.stripe.com https://checkout.stripe.com",
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://www.youtube.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ];
  
  // In development, be more permissive for hot reload and local services
  if (isDevelopment) {
    // Override with more permissive development CSP
    const devCspDirectives = [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co https://js.stripe.com https://checkout.stripe.com https://beacon-v2.helpscout.net http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://*.stripe.com https://www.gstatic.com https://*.ngrok.dev https://*.replicate.com http://localhost:* http://127.0.0.1:*",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ngrok.dev https://*.cloudfront.net ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:* http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:* https://api.stripe.com https://checkout.stripe.com https://beacon-v2.helpscout.net",
      "media-src 'self' blob: https://*.supabase.co https://*.ngrok.dev http://localhost:* http://127.0.0.1:*",
      "object-src 'none'",
      "child-src 'self' https://js.stripe.com https://checkout.stripe.com",
      "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://www.youtube.com https://player.vimeo.com",
      "worker-src 'self' blob:",
      "form-action 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ];
    response.headers.set('Content-Security-Policy', devCspDirectives.join('; '));
  } else {
    response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
  }
  
  // HSTS (only in production)
  if (!isDevelopment) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  // Remove potentially dangerous headers
  response.headers.delete('X-Powered-By');
  
  return response;
}