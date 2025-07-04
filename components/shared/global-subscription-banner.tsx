'use client';

import { useSubscription } from '@/components/providers/subscription-provider';
import { SubscriptionBanner } from '@/components/shared/billing/subscription-banner';

export function GlobalSubscriptionBanner() {
  const { accessStatus, subscription } = useSubscription();

  // Don't show banner for canceled subscriptions (they have their own dedicated card)
  if (subscription?.cancel_at_period_end) {
    return null;
  }

  // Only show banner if we have a message and should show banner
  if (!accessStatus.showBanner || !accessStatus.message) {
    return null;
  }

  return (
    <div className="border-b bg-background">
      <div className="mx-auto max-w-4xl px-4 lg:px-6">
        <SubscriptionBanner 
          message={accessStatus.message}
          type={accessStatus.bannerType || 'trial'}
          daysLeft={accessStatus.daysLeft}
        />
      </div>
    </div>
  );
} 