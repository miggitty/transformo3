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