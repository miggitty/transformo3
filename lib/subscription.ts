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
      showBanner: false,
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
        // If subscription is set to cancel at period end, show cancellation message
        if (subscription.cancel_at_period_end) {
          return {
            hasAccess: true,
            status: 'trialing',
            daysLeft: Math.max(0, daysLeft),
            showBanner: true,
            bannerType: 'expired',
            message: `Subscription canceled. Access ends in ${Math.max(0, daysLeft)} days.`,
          };
        }
        return {
          hasAccess: true,
          status: 'trialing',
          daysLeft: Math.max(0, daysLeft),
          showBanner: daysLeft > 0 && daysLeft <= 3, // Show banner only in last 3 days of active trial
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
        showBanner: false,
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
        showBanner: false,
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
        showBanner: false,
        message: 'Subscription expired. Please subscribe to continue using the platform.',
      };

    case 'incomplete':
    case 'incomplete_expired':
      return {
        hasAccess: false,
        status: 'access_denied',
        showBanner: false,
        message: 'Payment incomplete. Please complete your subscription setup.',
      };

    case 'unpaid':
      return {
        hasAccess: false,
        status: 'access_denied',
        showBanner: false,
        message: 'Subscription unpaid. Please update your payment method.',
      };

    default:
      return {
        hasAccess: false,
        status: 'access_denied',
        showBanner: false,
        message: 'Subscription status unknown. Please contact support.',
      };
  }
}

// Get plan display name from price ID
export function getPlanName(priceId: string): string {
  // Handle production price IDs
  if (priceId === process.env.STRIPE_MONTHLY_PRICE_ID) {
    return 'Monthly Plan ($199/month)';
  }
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) {
    return 'Yearly Plan ($1,990/year)';
  }
  
  // Handle test/dev price IDs
  if (priceId && (priceId.includes('monthly') || priceId.includes('month'))) {
    return 'Monthly Plan ($199/month)';
  }
  if (priceId && (priceId.includes('yearly') || priceId.includes('year'))) {
    return 'Yearly Plan ($1,990/year)';
  }
  
  // For now, default to Monthly Plan for any valid Stripe price ID
  // This is a temporary solution for the demo - in production, 
  // the webhook would ensure the correct price_id is stored
  if (priceId && priceId.startsWith('price_')) {
    return 'Monthly Plan ($199/month)';
  }
  
  return 'Unknown Plan';
}

// Calculate savings for yearly plan
export function calculateYearlySavings(): { monthlyTotal: number; yearlyPrice: number; savings: number; percentSavings: number } {
  const monthlyTotal = 199 * 12; // $199 × 12 months
  const yearlyPrice = 1990; // $1990 yearly
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