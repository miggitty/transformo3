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

  // Auto-refresh subscription status every 2 minutes (more frequent for better UX)
  useEffect(() => {
    const interval = setInterval(refreshSubscription, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Also refresh when the page becomes visible (user returns from another tab/app)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshSubscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
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