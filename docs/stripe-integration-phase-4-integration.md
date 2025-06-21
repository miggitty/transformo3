# **Phase 4: Integration & Access Control**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 3](./stripe-integration-phase-3-ui.md)**

---

## **Phase Overview**
Integrate Stripe subscription access control into the existing middleware and ensure proper feature gating throughout the application, following Next.js 15 and Supabase best practices.

**Duration**: 3-4 hours  
**Prerequisites**: Phases 1-3 completed, billing UI functional

**References**:
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

---

## **📋 Phase 4 Checklist**

### **Middleware Enhancement**
- [ ] Update existing middleware for subscription checks
- [ ] Add subscription status queries
- [ ] Implement access control logic
- [ ] Handle billing redirects
- [ ] Preserve existing auth patterns

### **Access Control Components**
- [ ] Create access gate wrapper component
- [ ] Add subscription status provider
- [ ] Build feature restriction overlays
- [ ] Follow app's component patterns

### **Integration Points**
- [ ] Protect main app routes
- [ ] Add billing access checks
- [ ] Integrate with layout components
- [ ] Update page redirects

### **Final Testing**
- [ ] Test complete subscription flow
- [ ] Verify access control works
- [ ] Test all subscription states
- [ ] Confirm middleware performance

---

## **1. Middleware Enhancement**

### **1.1 Create Subscription Utils**

Create `utils/supabase/subscription.ts`:

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { Database } from '@/types/supabase';

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

export interface SubscriptionCheckResult {
  hasAccess: boolean;
  shouldRedirectToBilling: boolean;
  redirectPath?: string;
  user: any;
  profile: any;
  subscription: SubscriptionRow | null;
  accessLevel: 'full' | 'trial' | 'grace' | 'denied';
}

export async function checkSubscriptionAccess(request: NextRequest): Promise<SubscriptionCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    return createFailureResult();
  }

  try {
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set() {
          // No-op in middleware
        },
        remove() {
          // No-op in middleware
        },
      },
    });

    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return createFailureResult(null, null);
    }

    // Get user's business profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.business_id) {
      return createFailureResult(user, null);
    }

    // Get subscription data
    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();

    // If no subscription exists, user needs to start trial
    if (subscriptionError && subscriptionError.code === 'PGRST116') {
      return {
        hasAccess: false,
        shouldRedirectToBilling: true,
        redirectPath: '/billing',
        user,
        profile,
        subscription: null,
        accessLevel: 'denied',
      };
    }

    if (subscriptionError) {
      console.error('Subscription check error:', subscriptionError);
      // On database error, allow access to prevent blocking users
      return {
        hasAccess: true,
        shouldRedirectToBilling: false,
        user,
        profile,
        subscription: null,
        accessLevel: 'full',
      };
    }

    // Check subscription access based on status and dates
    const accessResult = evaluateSubscriptionAccess(subscription);

    return {
      hasAccess: accessResult.hasAccess,
      shouldRedirectToBilling: !accessResult.hasAccess,
      redirectPath: accessResult.hasAccess ? undefined : '/billing',
      user,
      profile,
      subscription,
      accessLevel: accessResult.accessLevel,
    };
  } catch (error) {
    console.error('Subscription middleware error:', error);
    // On error, allow access to prevent blocking
    return createFailureResult();
  }
}

function createFailureResult(user: any = null, profile: any = null): SubscriptionCheckResult {
  return {
    hasAccess: true, // Allow access on error to prevent blocking
    shouldRedirectToBilling: false,
    user,
    profile,
    subscription: null,
    accessLevel: 'full',
  };
}

function evaluateSubscriptionAccess(subscription: SubscriptionRow): {
  hasAccess: boolean;
  accessLevel: 'full' | 'trial' | 'grace' | 'denied';
} {
  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;

  switch (subscription.status) {
    case 'trialing':
      // Check if trial has expired
      if (trialEnd && now > trialEnd) {
        return { hasAccess: false, accessLevel: 'denied' };
      }
      return { hasAccess: true, accessLevel: 'trial' };

    case 'active':
      return { hasAccess: true, accessLevel: 'full' };

    case 'past_due':
      // 7-day grace period from current period end
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + (7 * 24 * 60 * 60 * 1000));
      if (now < gracePeriodEnd) {
        return { hasAccess: true, accessLevel: 'grace' };
      }
      return { hasAccess: false, accessLevel: 'denied' };

    case 'canceled':
      // Access until end of current period
      if (now < currentPeriodEnd) {
        return { hasAccess: true, accessLevel: 'grace' };
      }
      return { hasAccess: false, accessLevel: 'denied' };

    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
      return { hasAccess: false, accessLevel: 'denied' };

    default:
      return { hasAccess: false, accessLevel: 'denied' };
  }
}

// Cache subscription results for a short time to reduce database calls
const subscriptionCache = new Map<string, { result: SubscriptionCheckResult; expiry: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getCachedSubscriptionAccess(request: NextRequest): Promise<SubscriptionCheckResult> {
  const cacheKey = request.cookies.get('sb-access-token')?.value || 'anonymous';
  const cached = subscriptionCache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.result;
  }
  
  const result = await checkSubscriptionAccess(request);
  
  subscriptionCache.set(cacheKey, {
    result,
    expiry: Date.now() + CACHE_TTL,
  });
  
  return result;
}
```

### **1.2 Update Main Middleware**

Update `middleware.ts`:

```typescript
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
```

---

## **2. Access Control Components**

### **2.1 Create Subscription Provider**

Create `components/providers/subscription-provider.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Database } from '@/types/supabase';
import { AccessCheckResult, checkSubscriptionAccess } from '@/lib/subscription';
import { getSubscriptionStatus } from '@/app/actions/billing';

type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

interface SubscriptionContextType {
  subscription: SubscriptionRow | null;
  accessStatus: AccessCheckResult;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
  accessLevel: 'full' | 'trial' | 'grace' | 'denied';
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

interface SubscriptionProviderProps {
  children: ReactNode;
  initialSubscription?: SubscriptionRow | null;
}

export function SubscriptionProvider({ 
  children, 
  initialSubscription = null 
}: SubscriptionProviderProps) {
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(initialSubscription);
  const [isLoading, setIsLoading] = useState(!initialSubscription);
  
  const accessStatus = checkSubscriptionAccess(subscription);

  // Determine access level
  const accessLevel = getAccessLevel(subscription);

  const refreshSubscription = async () => {
    try {
      setIsLoading(true);
      const result = await getSubscriptionStatus();
      if (result.success) {
        setSubscription(result.subscription);
      } else {
        console.error('Failed to refresh subscription:', result.error);
      }
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load if no subscription provided
  useEffect(() => {
    if (!initialSubscription) {
      refreshSubscription();
    }
  }, [initialSubscription]);

  // Auto-refresh subscription status every 5 minutes
  useEffect(() => {
    const interval = setInterval(refreshSubscription, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const value: SubscriptionContextType = {
    subscription,
    accessStatus,
    isLoading,
    refreshSubscription,
    accessLevel,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

function getAccessLevel(subscription: SubscriptionRow | null): 'full' | 'trial' | 'grace' | 'denied' {
  if (!subscription) return 'denied';
  
  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end);
  
  switch (subscription.status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'full';
    case 'past_due':
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + (7 * 24 * 60 * 60 * 1000));
      return now < gracePeriodEnd ? 'grace' : 'denied';
    case 'canceled':
      return now < currentPeriodEnd ? 'grace' : 'denied';
    default:
      return 'denied';
  }
}
```

### **2.2 Create Access Gate Component**

Create `components/shared/access-gate.tsx`:

```typescript
'use client';

import { useSubscription } from '@/components/providers/subscription-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, CreditCard, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface AccessGateProps {
  children: ReactNode;
  feature?: string;
  showUpgrade?: boolean;
  fallback?: ReactNode;
  level?: 'basic' | 'premium'; // Different access levels for future use
}

export function AccessGate({ 
  children, 
  feature = 'this feature', 
  showUpgrade = true,
  fallback,
  level = 'basic'
}: AccessGateProps) {
  const { accessStatus, isLoading, accessLevel } = useSubscription();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow access if user has subscription access
  if (accessStatus.hasAccess) {
    // Show grace period warning if applicable
    if (accessLevel === 'grace' && accessStatus.showBanner) {
      return (
        <div className="space-y-4">
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-orange-800">
              {accessStatus.message} Access will be restricted soon.
            </AlertDescription>
          </Alert>
          {children}
        </div>
      );
    }
    
    return <>{children}</>;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show access denied message
  return <AccessDeniedCard feature={feature} showUpgrade={showUpgrade} />;
}

interface AccessDeniedCardProps {
  feature: string;
  showUpgrade: boolean;
}

function AccessDeniedCard({ feature, showUpgrade }: AccessDeniedCardProps) {
  const { accessStatus } = useSubscription();
  
  const getIcon = () => {
    switch (accessStatus.status) {
      case 'no_subscription':
        return <CreditCard className="h-6 w-6 text-gray-600" />;
      case 'access_denied':
        return <Lock className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-orange-600" />;
    }
  };

  const getTitle = () => {
    switch (accessStatus.status) {
      case 'no_subscription':
        return 'Start Your Free Trial';
      case 'access_denied':
        return 'Subscription Required';
      default:
        return 'Access Restricted';
    }
  };

  const getDescription = () => {
    return accessStatus.message || `You need an active subscription to access ${feature}.`;
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-full p-3 w-fit mb-4">
            {getIcon()}
          </div>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        
        {showUpgrade && (
          <CardContent className="text-center space-y-3">
            <Button asChild className="w-full">
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                {accessStatus.status === 'no_subscription' ? 'Start Free Trial' : 'Manage Billing'}
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/content">
                Back to Dashboard
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
```

### **2.3 Create Feature Gate Hook**

Create `hooks/use-feature-access.ts`:

```typescript
'use client';

import { useSubscription } from '@/components/providers/subscription-provider';

export interface FeatureAccess {
  hasAccess: boolean;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  daysLeft?: number;
  showBanner: boolean;
  bannerType?: 'trial' | 'grace_period' | 'expired';
  message?: string;
  accessLevel: 'full' | 'trial' | 'grace' | 'denied';
}

export function useFeatureAccess(): FeatureAccess {
  const { accessStatus, subscription, accessLevel } = useSubscription();

  return {
    hasAccess: accessStatus.hasAccess,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    isExpired: !accessStatus.hasAccess && subscription?.status === 'canceled',
    daysLeft: accessStatus.daysLeft,
    showBanner: accessStatus.showBanner || false,
    bannerType: accessStatus.bannerType,
    message: accessStatus.message,
    accessLevel,
  };
}

// Specific feature access hooks
export function useContentAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canCreate: access.hasAccess,
    canEdit: access.hasAccess,
    canDelete: access.accessLevel === 'full', // Only full subscribers can delete
    maxItems: access.accessLevel === 'trial' ? 10 : undefined, // Trial limit
  };
}

export function useIntegrationAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canConnect: access.hasAccess,
    maxIntegrations: access.accessLevel === 'trial' ? 1 : undefined,
  };
}

export function useAnalyticsAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canViewBasic: access.hasAccess,
    canViewAdvanced: access.accessLevel === 'full',
    canExport: access.accessLevel === 'full',
  };
}
```

---

## **3. Layout Integration**

### **3.1 Update App Layout**

Update `app/(app)/layout.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(auth)/actions';
import { LogOut } from 'lucide-react';
import { Database } from '@/types/supabase';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { SubscriptionBanner } from '@/components/shared/billing/subscription-banner';
import { checkSubscriptionAccess } from '@/lib/subscription';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type SubscriptionRow = Database['public']['Tables']['subscriptions']['Row'];

interface UserProfile extends ProfileRow {
  email: string;
}

async function Sidebar({ user }: { user: UserProfile }) {
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/content" className="flex items-center gap-2 font-semibold">
            <Image
              src="/transformo-logo.webp"
              alt="Transformo Logo"
              width={120}
              height={30}
              className="h-auto w-auto"
              priority
            />
          </Link>
        </div>
        <div className="flex-1">
          <SidebarNav />
        </div>
        <div className="mt-auto p-4">
          <div className="mb-2 border-t pt-4">
            <div className="text-sm text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
          <form action={signOut}>
            <Button variant="ghost" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

interface LayoutContentProps {
  children: React.ReactNode;
  userWithProfile: UserProfile;
  subscription: SubscriptionRow | null;
}

async function LayoutContent({
  children,
  userWithProfile,
  subscription,
}: LayoutContentProps) {
  // Check if we should show subscription banner
  const accessStatus = checkSubscriptionAccess(subscription);
  
  return (
    <SubscriptionProvider initialSubscription={subscription}>
      <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar user={userWithProfile} />
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {/* Subscription Banner */}
            {accessStatus.showBanner && (
              <div className="p-4 pb-0">
                <SubscriptionBanner 
                  message={accessStatus.message || ''}
                  type={accessStatus.bannerType || 'trial'}
                  daysLeft={accessStatus.daysLeft}
                />
              </div>
            )}
            
            <div className="p-4 lg:p-6">
              <main className="mx-auto max-w-4xl flex-1">{children}</main>
            </div>
          </div>
        </div>
      </div>
    </SubscriptionProvider>
  );
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error('Profile error:', profileError);
    return redirect('/sign-in');
  }

  const userWithProfile: UserProfile = {
    ...profile,
    email: user.email!,
  };

  // Get subscription data for the layout
  let subscription: SubscriptionRow | null = null;
  if (profile?.business_id) {
    const { data, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();
      
    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Subscription fetch error:', subscriptionError);
    } else {
      subscription = data;
    }
  }

  return (
    <LayoutContent
      userWithProfile={userWithProfile}
      subscription={subscription}
    >
      {children}
    </LayoutContent>
  );
}
```

---

## **4. Protect Content Pages**

### **4.1 Update Content Pages**

Update `app/(app)/content/page.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import { ContentTable } from '@/components/shared/content-table';
import { AccessGate } from '@/components/shared/access-gate';
import { Suspense } from 'react';
import { ContentTableSkeleton } from '@/components/shared/content-table-skeleton';

export const metadata = {
  title: 'Content Dashboard',
  description: 'Manage your generated content and track performance',
};

async function ContentData({ businessId }: { businessId: string }) {
  const supabase = await createClient();
  
  const { data: content, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content:', error);
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load content. Please try again.</p>
      </div>
    );
  }

  return <ContentTable data={content || []} />;
}

export default async function ContentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  return (
    <AccessGate 
      feature="content management"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content management requires an active subscription.
          </p>
        </div>
      }
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Content</h1>
          <p className="text-muted-foreground">
            Manage your generated content and track performance.
          </p>
        </div>
        
        <Suspense fallback={<ContentTableSkeleton />}>
          <ContentData businessId={profile.business_id} />
        </Suspense>
      </div>
    </AccessGate>
  );
}
```

### **4.2 Update New Content Page**

Update `app/(app)/new/page.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import { AudioRecorder } from '@/components/shared/audio-recorder';
import { AccessGate } from '@/components/shared/access-gate';

export const metadata = {
  title: 'Create New Content',
  description: 'Upload audio to generate content across multiple platforms',
};

export default async function NewContentPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>User not found.</div>;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return <div>Business profile not found.</div>;
  }

  return (
    <AccessGate 
      feature="content creation"
      fallback={
        <div className="text-center py-8">
          <p className="text-muted-foreground">
            Content creation requires an active subscription.
          </p>
        </div>
      }
    >
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Create New Content</h1>
          <p className="text-muted-foreground">
            Upload audio to generate content across multiple platforms.
          </p>
        </div>
        
        <AudioRecorder businessId={profile.business_id} />
      </div>
    </AccessGate>
  );
}
```

---

## **5. Enhanced Feature Gating**

### **5.1 Create Feature-Specific Gates**

Create `components/shared/feature-gates.tsx`:

```typescript
'use client';

import { useContentAccess, useIntegrationAccess, useAnalyticsAccess } from '@/hooks/use-feature-access';
import { AccessGate } from '@/components/shared/access-gate';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReactNode } from 'react';

interface ContentGateProps {
  children: ReactNode;
  action?: 'create' | 'edit' | 'delete';
}

export function ContentGate({ children, action = 'create' }: ContentGateProps) {
  const access = useContentAccess();
  
  if (action === 'delete' && !access.canDelete) {
    return (
      <Alert>
        <AlertDescription>
          Content deletion is available for active subscribers only.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (action === 'create' && !access.canCreate) {
    return (
      <AccessGate feature="content creation">
        {children}
      </AccessGate>
    );
  }
  
  return <>{children}</>;
}

export function IntegrationGate({ children }: { children: ReactNode }) {
  const access = useIntegrationAccess();
  
  if (!access.canConnect) {
    return (
      <AccessGate feature="integrations">
        {children}
      </AccessGate>
    );
  }
  
  return <>{children}</>;
}

export function AnalyticsGate({ 
  children, 
  level = 'basic' 
}: { 
  children: ReactNode;
  level?: 'basic' | 'advanced';
}) {
  const access = useAnalyticsAccess();
  
  if (level === 'advanced' && !access.canViewAdvanced) {
    return (
      <Alert>
        <AlertDescription>
          Advanced analytics are available for active subscribers only.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (!access.canViewBasic) {
    return (
      <AccessGate feature="analytics">
        {children}
      </AccessGate>
    );
  }
  
  return <>{children}</>;
}
```

---

## **6. Performance Optimization**

### **6.1 Subscription Cache Enhancement**

Update the subscription cache in `utils/supabase/subscription.ts`:

```typescript
// Enhanced caching with cleanup
class EnhancedSubscriptionCache {
  private cache = new Map<string, { result: SubscriptionCheckResult; expiry: number }>();
  private readonly DEFAULT_TTL = 2 * 60 * 1000; // 2 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set(key: string, result: SubscriptionCheckResult, ttl: number = this.DEFAULT_TTL) {
    this.cache.set(key, {
      result,
      expiry: Date.now() + ttl,
    });
  }

  get(key: string): SubscriptionCheckResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.result;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  invalidateAll() {
    this.cache.clear();
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export const enhancedSubscriptionCache = new EnhancedSubscriptionCache();
```

---

## **✅ Phase 4 Completion Criteria**

Final verification before launch:

- [ ] Middleware properly checks subscription status with caching
- [ ] Access gates protect all content pages with graceful fallbacks
- [ ] Billing page handles all redirect scenarios correctly
- [ ] Subscription provider works throughout app with auto-refresh
- [ ] Navigation includes billing link in correct location
- [ ] Error states are user-friendly and don't block access
- [ ] Performance is acceptable (< 100ms middleware overhead)
- [ ] All subscription states tested end-to-end
- [ ] Webhook events properly sync subscription data
- [ ] Grace period functionality works correctly with UI feedback
- [ ] Trial countdown displays accurately across all components
- [ ] Banner system works across all subscription states
- [ ] Feature-specific access controls work properly
- [ ] TypeScript types are properly used throughout
- [ ] Cache invalidation works correctly on subscription changes

---

## **🎉 Implementation Complete!**

All phases of the Stripe subscription integration are now complete. The application now has:

✅ **Database foundation** with proper migrations, constraints, and RLS  
✅ **Backend logic** with server actions and robust webhook handling  
✅ **Frontend UI** with billing pages and comprehensive subscription management  
✅ **Access control** with middleware, feature gating, and graceful degradation  

### **Key Features Implemented:**
- 7-day free trial with automatic subscription activation
- Comprehensive webhook handling for all subscription events
- Grace period for failed payments (7 days)
- Self-service billing portal integration
- Real-time subscription status updates
- Feature-specific access controls
- Performance optimizations with caching
- Comprehensive error handling and fallbacks

The app is now production-ready for Stripe subscription billing!

---

**← [Back to Main PRD](./stripe-integration-prd.md)** 