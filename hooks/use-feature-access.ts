'use client';

import { useSubscription } from '@/components/providers/subscription-provider';

export interface FeatureAccess {
  hasAccess: boolean;
  isTrialing: boolean;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  isExpired: boolean;
  daysLeft?: number;
  showBanner: boolean;
  bannerType?: 'trial' | 'grace_period' | 'expired';
  message?: string;
  accessLevel: 'full' | 'trial' | 'grace' | 'denied';
}

export function useFeatureAccess(): FeatureAccess {
  const { accessStatus, subscription, accessLevel } = useSubscription();

  return {
    hasAccess: accessStatus.hasAccess,
    isTrialing: subscription?.status === 'trialing',
    isActive: subscription?.status === 'active',
    isPastDue: subscription?.status === 'past_due',
    isCanceled: subscription?.status === 'canceled',
    isExpired: !accessStatus.hasAccess && subscription?.status === 'canceled',
    daysLeft: accessStatus.daysLeft,
    showBanner: accessStatus.showBanner || false,
    bannerType: accessStatus.bannerType,
    message: accessStatus.message,
    accessLevel,
  };
}

// Specific feature access hooks
export function useContentAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canCreate: access.hasAccess,
    canEdit: access.hasAccess,
    canDelete: access.accessLevel === 'full', // Only full subscribers can delete
    maxItems: access.accessLevel === 'trial' ? 10 : undefined, // Trial limit
  };
}

export function useIntegrationAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canConnect: access.hasAccess,
    maxIntegrations: access.accessLevel === 'trial' ? 1 : undefined,
  };
}

export function useAnalyticsAccess() {
  const access = useFeatureAccess();
  return {
    ...access,
    canViewBasic: access.hasAccess,
    canViewAdvanced: access.accessLevel === 'full',
    canExport: access.accessLevel === 'full',
  };
} 