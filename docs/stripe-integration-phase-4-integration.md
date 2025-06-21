# **Phase 4: Integration & Access Control**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 3](./stripe-integration-phase-3-ui.md)**

---

## **Phase Overview**
Integrate Stripe subscription access control into the existing middleware and ensure proper feature gating throughout the application.

**Duration**: 3-4 hours  
**Prerequisites**: Phases 1-3 completed, billing UI functional

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
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { Tables } from '@/types/supabase';

export interface SubscriptionCheckResult {
  hasAccess: boolean;
  shouldRedirectToBilling: boolean;
  user: any;
  profile: any;
  subscription: Tables<'subscriptions'> | null;
}

export async function checkSubscriptionAccess(request: NextRequest): Promise<SubscriptionCheckResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      hasAccess: false,
      shouldRedirectToBilling: false,
      user: null,
      profile: null,
      subscription: null,
    };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        // No-op for middleware
      },
      remove(name: string, options: CookieOptions) {
        // No-op for middleware
      },
    },
  });

  try {
    // Check authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        hasAccess: false,
        shouldRedirectToBilling: false,
        user: null,
        profile: null,
        subscription: null,
      };
    }

    // Get user's business profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.business_id) {
      return {
        hasAccess: false,
        shouldRedirectToBilling: false,
        user,
        profile: null,
        subscription: null,
      };
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
        user,
        profile,
        subscription: null,
      };
    }

    if (subscriptionError) {
      // Database error - allow access to prevent blocking
      return {
        hasAccess: true,
        shouldRedirectToBilling: false,
        user,
        profile,
        subscription: null,
      };
    }

    // Check subscription access based on status and dates
    const hasAccess = checkSubscriptionStatus(subscription);

    return {
      hasAccess,
      shouldRedirectToBilling: !hasAccess,
      user,
      profile,
      subscription,
    };
  } catch (error) {
    console.error('Subscription check error:', error);
    // On error, allow access to prevent blocking
    return {
      hasAccess: true,
      shouldRedirectToBilling: false,
      user: null,
      profile: null,
      subscription: null,
    };
  }
}

function checkSubscriptionStatus(subscription: Tables<'subscriptions'>): boolean {
  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;

  switch (subscription.status) {
    case 'trialing':
    case 'active':
      return true;

    case 'past_due':
      // 7-day grace period
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + (7 * 24 * 60 * 60 * 1000));
      return now < gracePeriodEnd;

    case 'canceled':
      // Access until end of current period
      return now < currentPeriodEnd;

    default:
      return false;
  }
}
```

### **1.2 Update Main Middleware**

Update `middleware.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';
import { checkSubscriptionAccess } from '@/utils/supabase/subscription';

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
];

function shouldCheckSubscription(pathname: string): boolean {
  // Bypass certain routes
  if (BYPASS_ROUTES.some(route => pathname.startsWith(route))) {
    return false;
  }

  // Check if route requires subscription
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  try {
    // First, handle auth session
    const authResponse = await updateSession(request);
    
    // If auth middleware returned a redirect, respect it
    if (authResponse.status !== 200) {
      return authResponse;
    }

    const pathname = request.nextUrl.pathname;
    
    // Check if this route requires subscription verification
    if (!shouldCheckSubscription(pathname)) {
      return authResponse;
    }

    // Perform subscription check
    const subscriptionCheck = await checkSubscriptionAccess(request);
    
    // If no access and should redirect to billing
    if (!subscriptionCheck.hasAccess && subscriptionCheck.shouldRedirectToBilling) {
      const billingUrl = new URL('/billing', request.url);
      return NextResponse.redirect(billingUrl);
    }

    // Allow access (either has subscription or graceful degradation)
    return authResponse;
    
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## **2. Access Control Components**

### **2.1 Create Subscription Provider**

Create `components/providers/subscription-provider.tsx`:

```typescript
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Tables } from '@/types/supabase';
import { AccessCheckResult, checkSubscriptionAccess } from '@/lib/subscription';
import { getSubscriptionStatus } from '@/app/actions/billing';

interface SubscriptionContextType {
  subscription: Tables<'subscriptions'> | null;
  accessStatus: AccessCheckResult;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
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
  children: React.ReactNode;
  initialSubscription?: Tables<'subscriptions'> | null;
}

export function SubscriptionProvider({ children, initialSubscription = null }: SubscriptionProviderProps) {
  const [subscription, setSubscription] = useState<Tables<'subscriptions'> | null>(initialSubscription);
  const [isLoading, setIsLoading] = useState(!initialSubscription);
  
  const accessStatus = checkSubscriptionAccess(subscription);

  const refreshSubscription = async () => {
    try {
      setIsLoading(true);
      const result = await getSubscriptionStatus();
      if (result.success) {
        setSubscription(result.subscription);
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

  const value: SubscriptionContextType = {
    subscription,
    accessStatus,
    isLoading,
    refreshSubscription,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}
```

### **2.2 Create Access Gate Component**

Create `components/shared/access-gate.tsx`:

```typescript
'use client';

import { useSubscription } from '@/components/providers/subscription-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface AccessGateProps {
  children: React.ReactNode;
  feature?: string;
  showUpgrade?: boolean;
}

export function AccessGate({ children, feature = 'this feature', showUpgrade = true }: AccessGateProps) {
  const { accessStatus, isLoading } = useSubscription();

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
    return <>{children}</>;
  }

  // Show access denied message
  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gray-100 rounded-full p-3 w-fit mb-4">
            <Lock className="h-6 w-6 text-gray-600" />
          </div>
          <CardTitle>Subscription Required</CardTitle>
          <CardDescription>
            {accessStatus.message || `You need an active subscription to access ${feature}.`}
          </CardDescription>
        </CardHeader>
        
        {showUpgrade && (
          <CardContent className="text-center">
            <Button asChild className="w-full">
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                View Billing
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

export function useFeatureAccess() {
  const { accessStatus, subscription } = useSubscription();

  return {
    hasAccess: accessStatus.hasAccess,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    daysLeft: accessStatus.daysLeft,
    showBanner: accessStatus.showBanner,
    bannerType: accessStatus.bannerType,
    message: accessStatus.message,
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
import { Tables } from '@/types/supabase';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { SubscriptionBanner } from '@/components/shared/billing/subscription-banner';
import { checkSubscriptionAccess } from '@/lib/subscription';

async function Sidebar({
  user,
}: {
  user: Tables<'profiles'> & { email: string };
}) {
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

async function LayoutContent({
  children,
  userWithProfile,
  subscription,
}: {
  children: React.ReactNode;
  userWithProfile: Tables<'profiles'> & { email: string };
  subscription: Tables<'subscriptions'> | null;
}) {
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

  const userWithProfile = {
    ...profile,
    email: user.email!,
  };

  // Get subscription data for the layout
  let subscription = null;
  if (profile?.business_id) {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();
    subscription = data;
  }

  return (
    <LayoutContent
      userWithProfile={userWithProfile as Tables<'profiles'> & { email: string }}
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

  // Get content data
  const { data: content, error } = await supabase
    .from('content')
    .select(`
      *,
      businesses (
        business_name,
        timezone
      )
    `)
    .eq('business_id', profile.business_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content:', error);
    return <div>Error loading content.</div>;
  }

  return (
    <AccessGate feature="content management">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Content</h1>
          <p className="text-muted-foreground">
            Manage your generated content and track performance.
          </p>
        </div>
        
        <ContentTable data={content || []} />
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
    <AccessGate feature="content creation">
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

## **5. Performance Optimization**

### **5.1 Add Caching for Subscription Checks**

Create `lib/subscription-cache.ts`:

```typescript
// Simple in-memory cache for subscription status
// In production, consider using Redis or similar

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class SubscriptionCache {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

export const subscriptionCache = new SubscriptionCache();
```

---

## **6. Testing Checklist**

### **6.1 Subscription Flow Testing**

Test all subscription states:

```bash
# Test scenarios:
# 1. No subscription - should redirect to billing
# 2. Active trial - should show trial banner
# 3. Active subscription - full access
# 4. Past due - grace period access with warning
# 5. Canceled - access until period end
# 6. Expired - no access, redirect to billing
```

### **6.2 Performance Testing**

```bash
# Verify middleware performance
# Should add < 50ms to request time
# Test with concurrent requests
# Monitor database query performance
```

---

## **✅ Phase 4 Completion Criteria**

Final verification before launch:

- [ ] Middleware properly checks subscription status
- [ ] Access gates protect all content pages  
- [ ] Billing page handles all redirect scenarios
- [ ] Subscription provider works throughout app
- [ ] Navigation includes billing link
- [ ] Error states are user-friendly
- [ ] Performance is acceptable (< 100ms middleware)
- [ ] All subscription states tested end-to-end
- [ ] Webhook events properly sync subscription data
- [ ] Grace period functionality works correctly
- [ ] Trial countdown displays accurately
- [ ] Banner system works across all subscription states

---

## **🎉 Implementation Complete!**

All phases of the Stripe subscription integration are now complete. The application now has:

✅ **Database foundation** with proper migrations and RLS  
✅ **Backend logic** with server actions and webhook handling  
✅ **Frontend UI** with billing pages and subscription management  
✅ **Access control** with middleware and feature gating  

The app is ready for Stripe subscription billing with a 7-day free trial!

---

**← [Back to Main PRD](./stripe-integration-prd.md)** 