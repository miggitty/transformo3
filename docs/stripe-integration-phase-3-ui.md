# **Phase 3: UI Components & Forms**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 2](./stripe-integration-phase-2-api.md)**

---

## **Phase Overview**
Build frontend components for Stripe integration following Transformo's established ShadCN UI patterns and component structure.

**Duration**: 5-6 hours  
**Prerequisites**: Phase 2 completed, billing server actions implemented

---

## **📋 Phase 3 Checklist**

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

## **1. Required ShadCN Components**

### **1.1 Check Existing Components**

Verify these components exist in `components/ui/`:
- ✅ Button (`button.tsx`)
- ✅ Card (`card.tsx`) 
- ✅ Badge (`badge.tsx`)
- ✅ Form (`form.tsx`)
- ✅ Input (`input.tsx`)
- ✅ Select (`select.tsx`)

### **1.2 Add Missing Components**

```bash
# Add any missing components
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add skeleton
```

---

## **2. Update Navigation Structure**

### **2.1 Add Billing to Sidebar Navigation**

Update `components/shared/sidebar-nav.tsx`:

```typescript
import { CreditCard } from 'lucide-react';

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
  {
    href: '/billing',
    label: 'Billing',
    icon: CreditCard,
  },
];
```

**Note**: Add billing outside the settings submenu for better visibility.

---

## **3. Main Billing Page**

### **3.1 Create Billing Page Structure**

Create `app/(app)/billing/page.tsx`:

```typescript
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { BillingPageClient } from '@/components/shared/billing/billing-page-client';

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
    return <div>Error: Business profile not found.</div>;
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    return <div>Error: Could not load business data.</div>;
  }

  // Get subscription data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', profile.business_id)
    .single();

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <h1 className="text-3xl font-bold">Billing & Subscription</h1>
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
      } else {
        toast.error('Failed to refresh subscription status');
      }
    } catch (error) {
      toast.error('Failed to refresh subscription status');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
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
        <PlanSelectionCard />
      )}
    </div>
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
import { AccessCheckResult, getPlanName, calculateYearlySavings } from '@/lib/subscription';
import { createPortalSession } from '@/app/actions/billing';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw } from 'lucide-react';

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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const zonedDate = toZonedTime(date, 'UTC');
      return format(zonedDate, 'MMM d, yyyy');
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subscription Status</CardTitle>
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
                {subscription.status === 'trialing' && 'Free Trial'}
                {subscription.status === 'active' && 'Active'}
                {subscription.status === 'past_due' && 'Payment Due'}
                {subscription.status === 'canceled' && 'Canceled'}
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
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  Free Trial: {accessStatus.daysLeft} days remaining
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Your subscription will start automatically after the trial period.
                </p>
              </div>
            )}

            {/* Grace period warning */}
            {subscription.status === 'past_due' && accessStatus.daysLeft !== undefined && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-900">
                  Payment Failed: {accessStatus.daysLeft} days of access remaining
                </p>
                <p className="text-xs text-orange-700 mt-1">
                  Please update your payment method to maintain access.
                </p>
              </div>
            )}

            {/* Cancellation notice */}
            {subscription.status === 'canceled' && accessStatus.daysLeft !== undefined && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-900">
                  Subscription Canceled: {accessStatus.daysLeft} days of access remaining
                </p>
                <p className="text-xs text-gray-700 mt-1">
                  Reactivate your subscription to continue using all features.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <h3 className="text-lg font-medium">No Active Subscription</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Start your 7-day free trial to access all features
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {subscription ? (
          <Button 
            onClick={handlePortalAccess}
            disabled={isLoadingPortal}
            className="w-full"
          >
            {isLoadingPortal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Manage Subscription
          </Button>
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
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';

export function PlanSelectionCard() {
  const [isLoadingMonthly, setIsLoadingMonthly] = useState(false);
  const [isLoadingYearly, setIsLoadingYearly] = useState(false);
  
  const { savings } = calculateYearlySavings();

  const handlePlanSelection = async (plan: 'monthly' | 'yearly') => {
    const setLoading = plan === 'monthly' ? setIsLoadingMonthly : setIsLoadingYearly;
    
    setLoading(true);
    try {
      const result = await createCheckoutSession(plan);
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to create checkout session');
      }
    } catch (error) {
      toast.error('Failed to create checkout session');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    'Unlimited content generation',
    'AI-powered video creation',
    'Multi-platform publishing',
    'Advanced analytics',
    'Priority support',
    'Custom branding options',
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>
          Start with a 7-day free trial. No commitment, cancel anytime.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Features List */}
        <div>
          <h4 className="font-medium mb-3">What's included:</h4>
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
          <div className="border rounded-lg p-4 space-y-4">
            <div>
              <h3 className="font-semibold">Monthly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold">$199</span>
                <span className="text-sm text-muted-foreground">per month</span>
              </div>
            </div>
            
            <Button 
              onClick={() => handlePlanSelection('monthly')}
              disabled={isLoadingMonthly}
              className="w-full"
              variant="outline"
            >
              {isLoadingMonthly && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Free Trial
            </Button>
          </div>

          {/* Yearly Plan */}
          <div className="border rounded-lg p-4 space-y-4 relative">
            <Badge className="absolute -top-2 left-4 bg-green-600">
              Save ${savings}
            </Badge>
            
            <div>
              <h3 className="font-semibold">Yearly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-2xl font-bold">$1,990</span>
                <span className="text-sm text-muted-foreground">per year</span>
              </div>
              <p className="text-xs text-green-600 font-medium">
                2 months free compared to monthly
              </p>
            </div>
            
            <Button 
              onClick={() => handlePlanSelection('yearly')}
              disabled={isLoadingYearly}
              className="w-full"
            >
              {isLoadingYearly && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Free Trial
            </Button>
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground">
          <p>
            7-day free trial • No credit card required during trial • Cancel anytime
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
import { AlertTriangle, Clock, X } from 'lucide-react';

interface SubscriptionBannerProps {
  message: string;
  type: 'trial' | 'grace_period' | 'expired';
  daysLeft?: number;
}

export function SubscriptionBanner({ message, type, daysLeft }: SubscriptionBannerProps) {
  const getBannerStyles = () => {
    switch (type) {
      case 'trial':
        return {
          className: 'border-blue-200 bg-blue-50',
          icon: <Clock className="h-4 w-4 text-blue-600" />,
          textColor: 'text-blue-800'
        };
      case 'grace_period':
        return {
          className: 'border-orange-200 bg-orange-50',
          icon: <AlertTriangle className="h-4 w-4 text-orange-600" />,
          textColor: 'text-orange-800'
        };
      case 'expired':
        return {
          className: 'border-red-200 bg-red-50',
          icon: <X className="h-4 w-4 text-red-600" />,
          textColor: 'text-red-800'
        };
      default:
        return {
          className: 'border-gray-200 bg-gray-50',
          icon: <Clock className="h-4 w-4 text-gray-600" />,
          textColor: 'text-gray-800'
        };
    }
  };

  const styles = getBannerStyles();

  return (
    <Alert className={styles.className}>
      <div className="flex items-center space-x-3">
        {styles.icon}
        <div className="flex-1">
          <AlertDescription className={`${styles.textColor} font-medium`}>
            {message}
          </AlertDescription>
        </div>
        {daysLeft !== undefined && (
          <Badge variant="outline" className="ml-auto">
            {daysLeft} days left
          </Badge>
        )}
      </div>
    </Alert>
  );
}
```

---

## **7. Update Navigation**

### **7.1 Update Sidebar Navigation**

Update `components/shared/sidebar-nav.tsx`:

```typescript
// Add import
import { CreditCard } from 'lucide-react';

// Update navigationItems array (add billing to main nav, not settings)
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
```

---

## **✅ Phase 3 Completion Criteria**

Before moving to Phase 4, verify:

- [ ] Billing page renders correctly with all components
- [ ] Plan selection creates checkout sessions
- [ ] Subscription status displays properly
- [ ] Navigation includes billing link
- [ ] Loading states work properly
- [ ] Error handling displays user-friendly messages
- [ ] Responsive design works on mobile
- [ ] Banner component shows correct states
- [ ] Portal access button redirects correctly
- [ ] Trial countdown displays accurately

---

**Next Phase**: [Phase 4: Integration & Access Control](./stripe-integration-phase-4-integration.md) 