# **Phase 3: UI Components & Forms**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 2](./stripe-integration-phase-2-api.md)**

---

## **Phase Overview**
Build frontend components for Stripe integration following Transformo's established ShadCN UI patterns and component structure, with proper Stripe Elements integration.

**Duration**: 5-6 hours  
**Prerequisites**: Phase 2 completed, billing server actions implemented

**References**:
- [Stripe Elements Guide](https://stripe.com/docs/stripe-js)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)
- [React Stripe.js](https://github.com/stripe/react-stripe-js)

---

## **📋 Phase 3 Checklist**

### **Stripe Elements Setup**
- [ ] Install React Stripe.js
- [ ] Configure Stripe provider
- [ ] Set up Elements integration
- [ ] Add proper error handling

### **ShadCN Components Setup**
- [ ] Verify required ShadCN components are installed
- [ ] Add any missing UI components
- [ ] Create billing page layout
- [ ] Set up proper navigation integration

### **Billing Page Components**
- [ ] Create main billing page
- [ ] Build subscription status card component
- [ ] Create plan selection cards
- [ ] Add trial countdown component
- [ ] Build subscription banner component

### **Form Components**
- [ ] Create checkout form integration
- [ ] Add portal access button
- [ ] Implement subscription management UI
- [ ] Follow app's form patterns

### **Integration**
- [ ] Add billing to sidebar navigation
- [ ] Integrate with layout structure
- [ ] Add proper loading states
- [ ] Implement error handling

### **Validation**
- [ ] Test all billing UI flows
- [ ] Verify responsive design
- [ ] Test loading and error states
- [ ] Confirm accessibility

---

## **1. Stripe Elements Setup**

### **1.1 Install React Stripe.js**

```bash
# Install React Stripe.js for proper Elements integration
npm install @stripe/react-stripe-js

# Verify @stripe/stripe-js is already installed from Phase 2
npm list @stripe/stripe-js
```

### **1.2 Create Stripe Provider**

Create `lib/stripe-client.ts`:

```typescript
import { loadStripe } from '@stripe/stripe-js';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render.
export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set');
}
```

### **1.3 Required ShadCN Components**

Verify these components exist in `components/ui/`:

```bash
# Check existing components
ls components/ui/

# Add missing components if needed
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
npx shadcn-ui@latest add scroll-area
```

---

## **2. Update Navigation Structure**

### **2.1 Add Billing to Sidebar Navigation**

Update `components/shared/sidebar-nav.tsx`:

```typescript
import { CreditCard, LayoutGrid, PlusCircle, Building2, Plug } from 'lucide-react';

// Update the main navigation items (not in settings submenu)
const navigationItems = [
  {
    href: '/content',
    label: 'Content',
    icon: LayoutGrid,
  },
  {
    href: '/new',
    label: 'New Content',
    icon: PlusCircle,
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: CreditCard,
  },
];

// Settings items remain the same
const settingsItems = [
  {
    href: '/settings/business',
    label: 'Business Settings',
    icon: Building2,
  },
  {
    href: '/settings/integrations',
    label: 'Integrations',
    icon: Plug,
  },
];
```

---

## **3. Main Billing Page**

### **3.1 Create Billing Page Structure**

Create `app/(app)/billing/page.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { BillingPageClient } from '@/components/shared/billing/billing-page-client';

export const metadata = {
  title: 'Billing & Subscription',
  description: 'Manage your subscription and billing settings',
};

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium">Business Profile Not Found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium">Error Loading Business Data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error?.message || 'Could not load business data'}
          </p>
        </div>
      </div>
    );
  }

  // Get subscription data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', profile.business_id)
    .single();

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription and billing settings
        </p>
      </div>
      
      <BillingPageClient 
        business={business}
        subscription={subscription}
      />
    </div>
  );
}
```

### **3.2 Create Client Component**

Create `components/shared/billing/billing-page-client.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe-client';
import { Tables } from '@/types/supabase';
import { SubscriptionStatusCard } from './subscription-status-card';
import { PlanSelectionCard } from './plan-selection-card';
import { SubscriptionBanner } from './subscription-banner';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { getSubscriptionStatus } from '@/app/actions/billing';
import { toast } from 'sonner';

interface BillingPageClientProps {
  business: Tables<'businesses'>;
  subscription: Tables<'subscriptions'> | null;
}

export function BillingPageClient({ business, subscription: initialSubscription }: BillingPageClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const accessStatus = checkSubscriptionAccess(subscription);

  // Handle URL parameters for success/cancel
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const sessionId = urlParams.get('session_id');

    if (success === 'true') {
      toast.success('Subscription activated successfully!');
      refreshSubscription();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      toast.error('Subscription setup was canceled.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const refreshSubscription = async () => {
    setIsRefreshing(true);
    try {
      const result = await getSubscriptionStatus();
      if (result.success) {
        setSubscription(result.subscription);
        toast.success('Subscription status updated');
      } else {
        toast.error('Failed to refresh subscription status');
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
      toast.error('Failed to refresh subscription status');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="space-y-6">
        {/* Status Banner */}
        {accessStatus.showBanner && (
          <SubscriptionBanner 
            message={accessStatus.message || ''}
            type={accessStatus.bannerType || 'trial'}
            daysLeft={accessStatus.daysLeft}
          />
        )}

        {/* Current Subscription Status */}
        <SubscriptionStatusCard 
          subscription={subscription}
          accessStatus={accessStatus}
          onRefresh={refreshSubscription}
          isRefreshing={isRefreshing}
        />

        {/* Plan Selection (only show if no active subscription) */}
        {!subscription && (
          <PlanSelectionCard business={business} />
        )}
      </div>
    </Elements>
  );
}
```

---

## **4. Subscription Status Card**

### **4.1 Create Status Card Component**

Create `components/shared/billing/subscription-status-card.tsx`:

```typescript
'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tables } from '@/types/supabase';
import { AccessCheckResult, getPlanName, calculateYearlySavings, formatPrice } from '@/lib/subscription';
import { createPortalSession, cancelSubscription } from '@/app/actions/billing';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ExternalLink, Calendar, CreditCard, AlertTriangle } from 'lucide-react';

interface SubscriptionStatusCardProps {
  subscription: Tables<'subscriptions'> | null;
  accessStatus: AccessCheckResult;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function SubscriptionStatusCard({ 
  subscription, 
  accessStatus, 
  onRefresh, 
  isRefreshing 
}: SubscriptionStatusCardProps) {
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handlePortalAccess = async () => {
    setIsLoadingPortal(true);
    try {
      const result = await createPortalSession();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to access billing portal');
      }
    } catch (error) {
      toast.error('Failed to access billing portal');
    } finally {
      setIsLoadingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You\'ll maintain access until the end of your billing period.')) {
      return;
    }

    setIsCanceling(true);
    try {
      const result = await cancelSubscription();
      if (result.success) {
        toast.success('Subscription canceled. You\'ll maintain access until the end of your billing period.');
        onRefresh();
      } else {
        toast.error(result.error || 'Failed to cancel subscription');
      }
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'trialing':
        return 'secondary';
      case 'past_due':
        return 'destructive';
      case 'canceled':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CreditCard className="h-4 w-4" />;
      case 'trialing':
        return <Calendar className="h-4 w-4" />;
      case 'past_due':
        return <AlertTriangle className="h-4 w-4" />;
      case 'canceled':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'trialing':
        return 'Free Trial';
      case 'active':
        return 'Active';
      case 'past_due':
        return 'Payment Due';
      case 'canceled':
        return 'Canceled';
      case 'incomplete':
        return 'Incomplete';
      case 'unpaid':
        return 'Unpaid';
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {subscription && getStatusIcon(subscription.status)}
              Subscription Status
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing settings
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {subscription ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={getStatusBadgeVariant(subscription.status)}>
                {getStatusDisplayName(subscription.status)}
              </Badge>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm font-medium">Plan</span>
                <p className="text-sm text-muted-foreground">
                  {getPlanName(subscription.price_id)}
                </p>
              </div>
              
              <div>
                <span className="text-sm font-medium">
                  {subscription.status === 'trialing' ? 'Trial Ends' : 'Next Billing'}
                </span>
                <p className="text-sm text-muted-foreground">
                  {subscription.trial_end 
                    ? formatDate(subscription.trial_end)
                    : formatDate(subscription.current_period_end)
                  }
                </p>
              </div>
            </div>

            {/* Trial countdown */}
            {subscription.status === 'trialing' && accessStatus.daysLeft !== undefined && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Free Trial: {accessStatus.daysLeft} days remaining
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Your subscription will start automatically after the trial period.
                </p>
              </div>
            )}

            {/* Grace period warning */}
            {subscription.status === 'past_due' && accessStatus.daysLeft !== undefined && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-950 dark:border-orange-800">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                  Payment Failed: {accessStatus.daysLeft} days of access remaining
                </p>
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Please update your payment method to maintain access.
                </p>
              </div>
            )}

            {/* Cancellation notice */}
            {subscription.status === 'canceled' && accessStatus.daysLeft !== undefined && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg dark:bg-gray-900 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Subscription Canceled: {accessStatus.daysLeft} days of access remaining
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-400 mt-1">
                  Reactivate your subscription to continue using all features.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <div className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-full p-3 w-fit mb-4">
              <CreditCard className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium">No Active Subscription</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Start your 7-day free trial to access all features
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-2">
        {subscription ? (
          <>
            <Button 
              onClick={handlePortalAccess}
              disabled={isLoadingPortal}
              className="flex-1"
            >
              {isLoadingPortal ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage Billing
            </Button>
            
            {subscription.status === 'active' && (
              <Button 
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={isCanceling}
              >
                {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel
              </Button>
            )}
          </>
        ) : null}
      </CardFooter>
    </Card>
  );
}
```

---

## **5. Plan Selection Card**

### **5.1 Create Plan Selection Component**

Create `components/shared/billing/plan-selection-card.tsx`:

```typescript
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createCheckoutSession } from '@/app/actions/billing';
import { calculateYearlySavings } from '@/lib/subscription';
import { Tables } from '@/types/supabase';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Sparkles, Star } from 'lucide-react';

interface PlanSelectionCardProps {
  business: Tables<'businesses'>;
}

export function PlanSelectionCard({ business }: PlanSelectionCardProps) {
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [isLoadingYearly, setIsLoadingYearly] = useState(false);
  
  const { savings, percentSavings } = calculateYearlySavings();

  const handlePlanSelection = async (plan: 'monthly' | 'yearly') => {
    const setLoading = plan === 'monthly' ? setIsLoadingMonthly : setIsLoadingYearly;
    
    setLoading(true);
    try {
      const result = await createCheckoutSession(plan);
      if (result.success && result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Unlimited content generation',
    'AI-powered video creation with HeyGen',
    'Multi-platform publishing automation',
    'Advanced analytics and insights',
    'Priority customer support',
    'Custom branding options',
    'Team collaboration tools',
    'API access for integrations',
  ];

  const isLoading = isLoadingMonthly || isLoadingYearly;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Choose Your Plan</CardTitle>
        </div>
        <CardDescription>
          Start with a 7-day free trial. No credit card required during trial. Cancel anytime.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Features List */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            What's included:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monthly Plan */}
          <div className="border rounded-lg p-4 space-y-4 relative hover:border-primary/50 transition-colors">
            <div>
              <h3 className="font-semibold text-lg">Monthly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold">$199</span>
                <span className="text-sm text-muted-foreground">per month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Billed monthly • Cancel anytime
              </p>
            </div>
            
            <Button 
              onClick={() => handlePlanSelection('monthly')}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoadingMonthly ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Free Trial
            </Button>
          </div>

          {/* Yearly Plan */}
          <div className="border rounded-lg p-4 space-y-4 relative hover:border-primary/50 transition-colors">
            <Badge className="absolute -top-2 left-4 bg-green-600 hover:bg-green-700">
              Save {percentSavings}% (${savings})
            </Badge>
            
            <div>
              <h3 className="font-semibold text-lg">Yearly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold">$1,990</span>
                <span className="text-sm text-muted-foreground">per year</span>
              </div>
              <p className="text-xs text-green-600 font-medium">
                ${Math.round(1990/12)} per month • 2 months free
              </p>
            </div>
            
            <Button 
              onClick={() => handlePlanSelection('yearly')}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isLoadingYearly ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Free Trial
            </Button>
          </div>
        </div>

        {/* Trial Information */}
        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium">🎉 7-Day Free Trial</p>
            <p>
              No payment required during trial • Full access to all features • Cancel anytime
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            After your trial ends, you'll be charged based on your selected plan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## **6. Subscription Banner Component**

### **6.1 Create Banner Component**

Create `components/shared/billing/subscription-banner.tsx`:

```typescript
'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X, CreditCard, Calendar } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionBannerProps {
  message: string;
  type: 'trial' | 'grace_period' | 'expired';
  daysLeft?: number;
}

export function SubscriptionBanner({ message, type, daysLeft }: SubscriptionBannerProps) {
  const getBannerConfig = () => {
    switch (type) {
      case 'trial':
        return {
          className: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
          icon: <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
          textColor: 'text-blue-800 dark:text-blue-200',
          badgeVariant: 'secondary' as const,
          actionButton: daysLeft && daysLeft <= 3 ? (
            <Button size="sm" asChild>
              <Link href="/billing">
                Upgrade Now
              </Link>
            </Button>
          ) : null,
        };
      case 'grace_period':
        return {
          className: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950',
          icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
          textColor: 'text-orange-800 dark:text-orange-200',
          badgeVariant: 'destructive' as const,
          actionButton: (
            <Button size="sm" variant="outline" asChild>
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment
              </Link>
            </Button>
          ),
        };
      case 'expired':
        return {
          className: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
          icon: <X className="h-4 w-4 text-red-600 dark:text-red-400" />,
          textColor: 'text-red-800 dark:text-red-200',
          badgeVariant: 'destructive' as const,
          actionButton: (
            <Button size="sm" asChild>
              <Link href="/billing">
                Reactivate
              </Link>
            </Button>
          ),
        };
      default:
        return {
          className: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900',
          icon: <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />,
          textColor: 'text-gray-800 dark:text-gray-200',
          badgeVariant: 'secondary' as const,
          actionButton: null,
        };
    }
  };

  const config = getBannerConfig();

  return (
    <Alert className={config.className}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-3 flex-1">
          {config.icon}
          <div className="flex-1">
            <AlertDescription className={`${config.textColor} font-medium`}>
              {message}
            </AlertDescription>
          </div>
          {daysLeft !== undefined && (
            <Badge variant={config.badgeVariant} className="ml-auto mr-2">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </Badge>
          )}
        </div>
        {config.actionButton && (
          <div className="ml-4">
            {config.actionButton}
          </div>
        )}
      </div>
    </Alert>
  );
}
```

---

## **7. Billing Success/Cancel Pages**

### **7.1 Create Success Page**

Create `app/(app)/billing/success/page.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function BillingSuccessPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  return (
    <div className="flex items-center justify-center min-h-[600px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 rounded-full p-3 w-fit mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Welcome to Transformo!</CardTitle>
          <CardDescription>
            Your subscription has been activated successfully. Your 7-day free trial has started.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You now have full access to all Transformo features. Start creating amazing content!
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/new">
                  Start Creating Content
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/billing">
                  View Billing Details
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### **7.2 Create Cancel Page**

Create `app/(app)/billing/cancel/page.tsx`:

```typescript
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function BillingCancelPage() {
  return (
    <div className="flex items-center justify-center min-h-[600px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gray-100 rounded-full p-3 w-fit mb-4">
            <XCircle className="h-8 w-8 text-gray-600" />
          </div>
          <CardTitle className="text-2xl">Subscription Canceled</CardTitle>
          <CardDescription>
            No worries! You can start your subscription at any time.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your subscription setup was canceled. You can try again whenever you're ready.
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/billing">
                  Try Again
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/content">
                  Back to App
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## **✅ Phase 3 Completion Criteria**

Before moving to Phase 4, verify:

- [ ] Stripe Elements properly integrated
- [ ] Billing page renders correctly with all components
- [ ] Plan selection creates checkout sessions
- [ ] Subscription status displays properly
- [ ] Navigation includes billing link
- [ ] Loading states work properly
- [ ] Error handling displays user-friendly messages
- [ ] Responsive design works on mobile and desktop
- [ ] Banner component shows correct states
- [ ] Portal access button redirects correctly
- [ ] Trial countdown displays accurately
- [ ] Success and cancel pages work correctly
- [ ] Dark mode support implemented
- [ ] Accessibility requirements met
- [ ] TypeScript types are properly used

---

**Next Phase**: [Phase 4: Integration & Access Control](./stripe-integration-phase-4-integration.md) 