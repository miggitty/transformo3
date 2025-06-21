import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { getCachedSubscriptionAccess } from '@/utils/supabase/subscription';

// Routes that require subscription access
const PROTECTED_ROUTES = [
  '/content',
  '/new',
  '/settings',
];

// Routes that should bypass subscription checks
const BYPASS_ROUTES = [
  '/billing',
  '/sign-in',
  '/sign-up',
  '/sign-out',
  '/api',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
];

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  '/',
  '/about',
  '/pricing',
  '/contact',
];

function shouldCheckSubscription(pathname: string): boolean {
  // Bypass certain routes
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Public routes don't need subscription checks
  if (PUBLIC_ROUTES.includes(pathname)) {
    return false;
  }

  // Check if route requires subscription
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route)) || pathname.startsWith('/app');
}

function shouldRedirectToAuth(pathname: string): boolean {
  return !BYPASS_ROUTES.some(route => pathname.startsWith(route)) && 
         !PUBLIC_ROUTES.includes(pathname);
}

export async function middleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    
    // First, handle auth session
    const authResponse = await updateSession(request);
    
    // If auth middleware returned a redirect, check if it's an auth redirect
    if (authResponse.status !== 200) {
      const location = authResponse.headers.get('location');
      if (location?.includes('/sign-in') && shouldRedirectToAuth(pathname)) {
        return authResponse; // Allow auth redirect
      }
      if (authResponse.status === 200) {
        // Continue with subscription check if auth was successful
      } else {
        return authResponse; // Return other redirects as-is
      }
    }

    // Check if this route requires subscription verification
    if (!shouldCheckSubscription(pathname)) {
      return authResponse;
    }

    // Perform subscription check with caching
    const subscriptionCheck = await getCachedSubscriptionAccess(request);
    
    // If no access and should redirect to billing
    if (!subscriptionCheck.hasAccess && subscriptionCheck.shouldRedirectToBilling) {
      const billingUrl = new URL('/billing', request.url);
      
      // Add context about where user was trying to go
      if (pathname !== '/billing') {
        billingUrl.searchParams.set('redirect', pathname);
      }
      
      return NextResponse.redirect(billingUrl);
    }

    // Add subscription context to headers for use in components
    const response = authResponse.status === 200 ? authResponse : NextResponse.next();
    
    response.headers.set('x-subscription-status', subscriptionCheck.subscription?.status || 'none');
    response.headers.set('x-access-level', subscriptionCheck.accessLevel);
    
    return response;
    
  } catch (error) {
    console.error('Middleware error:', error);
    // On error, continue with auth response to prevent blocking
    return await updateSession(request);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}; 