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
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface BillingPageClientProps {
  business: Tables<'businesses'>;
  subscription: Tables<'subscriptions'> | null;
}

export function BillingPageClient({ business, subscription: initialSubscription }: BillingPageClientProps) {
  const [subscription, setSubscription] = useState(initialSubscription);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const accessStatus = checkSubscriptionAccess(subscription);

  // Handle URL parameters for success/cancel and auto-refresh on page focus
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const setupCanceled = urlParams.get('setup_canceled');

    if (success === 'true') {
      toast.success('Subscription activated successfully!');
      refreshSubscription();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      toast.error('Subscription setup was canceled.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (setupCanceled === 'true') {
      toast.error('Trial setup was canceled. You can try again anytime to start your free trial.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Auto-refresh subscription when user returns to page (e.g., from Stripe portal)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible, refresh subscription status immediately and after a delay
        refreshSubscription();
        setTimeout(refreshSubscription, 2000);
        setTimeout(refreshSubscription, 5000); // Multiple attempts to catch webhook updates
      }
    };

    // Also refresh when page gains focus (clicking back into the window)
    const handleFocus = () => {
      refreshSubscription();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const refreshSubscription = async () => {
    setIsRefreshing(true);
    try {
      const result = await getSubscriptionStatus();
      if (result.success) {
        setSubscription(result.subscription);
      }
    } catch (error) {
      console.error('Error refreshing subscription:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Elements stripe={stripePromise}>
      <div className="space-y-6">
        {/* Status Banner - only show for non-canceled subscriptions */}
        {accessStatus.showBanner && !subscription?.cancel_at_period_end && (
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

        {/* Plan Selection */}
        <PlanSelectionCard 
          business={business} 
          subscription={subscription}
        />
      </div>
    </Elements>
  );
} 