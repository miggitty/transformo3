import { Tables } from '@/types/supabase';

export type SubscriptionStatus = 'no_subscription' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'access_denied';

export interface AccessCheckResult {
  hasAccess: boolean;
  status: SubscriptionStatus;
  daysLeft?: number;
  message?: string;
  showBanner?: boolean;
  bannerType?: 'trial' | 'grace_period' | 'expired';
}

// Check if user has access based on subscription status
export function checkSubscriptionAccess(subscription: Tables<'subscriptions'> | null): AccessCheckResult {
  // No subscription found
  if (!subscription) {
    return {
      hasAccess: false,
      status: 'no_subscription',
      message: 'Start your 7-day free trial to access all features',
    };
  }

  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;

  switch (subscription.status) {
    case 'trialing':
      if (trialEnd) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'trialing',
          daysLeft: Math.max(0, daysLeft),
          showBanner: daysLeft <= 3, // Show banner in last 3 days of trial
          bannerType: 'trial',
          message: daysLeft > 0 
            ? `${Math.max(0, daysLeft)} days left in your free trial`
            : 'Your free trial has ended',
        };
      }
      return {
        hasAccess: true,
        status: 'trialing',
        showBanner: true,
        bannerType: 'trial',
        message: 'Free trial active',
      };

    case 'active':
      return {
        hasAccess: true,
        status: 'active',
      };

    case 'past_due':
      // 7-day grace period from current period end
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + (7 * 24 * 60 * 60 * 1000));
      if (now < gracePeriodEnd) {
        const daysLeft = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'past_due',
          daysLeft: Math.max(0, daysLeft),
          showBanner: true,
          bannerType: 'grace_period',
          message: `Payment failed. Update your payment method within ${Math.max(0, daysLeft)} days to maintain access.`,
        };
      }
      // Grace period expired
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Access suspended due to payment failure. Please update your payment method.',
      };

    case 'canceled':
      // Access until end of current period
      if (now < currentPeriodEnd) {
        const daysLeft = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'canceled',
          daysLeft: Math.max(0, daysLeft),
          showBanner: true,
          bannerType: 'expired',
          message: `Subscription canceled. Access ends in ${Math.max(0, daysLeft)} days.`,
        };
      }
      // Period ended
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription expired. Please subscribe to continue using the platform.',
      };

    case 'incomplete':
    case 'incomplete_expired':
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Payment incomplete. Please complete your subscription setup.',
      };

    case 'unpaid':
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription unpaid. Please update your payment method.',
      };

    default:
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription status unknown. Please contact support.',
      };
  }
}

// Get plan display name from price ID
export function getPlanName(priceId: string): string {
  if (priceId === process.env.STRIPE_MONTHLY_PRICE_ID) {
    return 'Monthly Plan';
  }
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) {
    return 'Yearly Plan';
  }
  return 'Unknown Plan';
}

// Calculate savings for yearly plan
export function calculateYearlySavings(): { monthlyTotal: number; yearlyPrice: number; savings: number; percentSavings: number } {
  const monthlyTotal = 29 * 12; // $29 × 12 months
  const yearlyPrice = 290; // $290 yearly
  const savings = monthlyTotal - yearlyPrice;
  const percentSavings = Math.round((savings / monthlyTotal) * 100);
  
  return {
    monthlyTotal,
    yearlyPrice,
    savings,
    percentSavings,
  };
}

// Format price for display
export function formatPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
} 