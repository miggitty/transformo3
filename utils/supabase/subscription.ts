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

    // If subscription is null but no error, still redirect to billing
    if (!subscription) {
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

    // Be more permissive for active and trialing subscriptions
    const hasAccess = accessResult.hasAccess || 
                      subscription.status === 'active' || 
                      subscription.status === 'trialing';

    return {
      hasAccess,
      shouldRedirectToBilling: !hasAccess,
      redirectPath: hasAccess ? undefined : '/billing',
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

// Function to clear cache (useful for debugging)
export function clearSubscriptionCache() {
  subscriptionCache.clear();
}

export async function getCachedSubscriptionAccess(request: NextRequest): Promise<SubscriptionCheckResult> {
  // Temporarily disable cache to ensure fresh subscription checks
  const result = await checkSubscriptionAccess(request);
  return result;
}

// Force refresh cache (for manual refreshes)
export function forceRefreshCache() {
  subscriptionCache.clear();
} 