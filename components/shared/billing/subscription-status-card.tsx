'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tables } from '@/types/supabase';
import { AccessCheckResult, getPlanName } from '@/lib/subscription';
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
    } catch {
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
        
        // Immediate refresh
        onRefresh();
        
        // Additional refreshes to catch webhook updates
        setTimeout(() => onRefresh(), 1000);
        setTimeout(() => onRefresh(), 3000);
        setTimeout(() => onRefresh(), 5000);
      } else {
        toast.error(result.error || 'Failed to cancel subscription');
      }
    } catch {
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
        // Check if trial has ended but status hasn't updated yet
        if (accessStatus.daysLeft === 0 || (accessStatus.daysLeft === undefined && subscription?.trial_end && new Date(subscription.trial_end) <= new Date())) {
          return 'Active';
        }
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

  // Show different layout for canceled subscriptions
  if (subscription?.cancel_at_period_end) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                <AlertTriangle className="h-5 w-5" />
                Subscription Canceled
              </CardTitle>
              <CardDescription className="text-red-700 dark:text-red-300">
                Your subscription will end when your trial period expires
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="text-red-700 hover:text-red-900 dark:text-red-300"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center py-4">
            <div className="text-3xl font-bold text-red-900 dark:text-red-100 mb-2">
              {accessStatus.daysLeft} days left
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Access ends on {subscription.trial_end ? formatDate(subscription.trial_end) : formatDate(subscription.current_period_end)}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-red-900 dark:text-red-100">Plan</span>
              <p className="text-red-700 dark:text-red-300">Trial (Canceled)</p>
            </div>
            <div>
              <span className="font-medium text-red-900 dark:text-red-100">Canceled On</span>
              <p className="text-red-700 dark:text-red-300">
                {subscription.canceled_at ? formatDate(subscription.canceled_at) : 'Recently'}
              </p>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-3">
          <Button 
            onClick={handlePortalAccess}
            disabled={isLoadingPortal}
            className="w-full bg-red-600 hover:bg-red-700 text-white"
            size="lg"
          >
            {isLoadingPortal ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Reactivate Subscription
          </Button>
          <p className="text-xs text-red-600 dark:text-red-400 text-center">
            Reactivate before {subscription.trial_end ? formatDate(subscription.trial_end) : formatDate(subscription.current_period_end)} to continue using all features
          </p>
        </CardFooter>
      </Card>
    );
  }

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
                  {subscription.status === 'trialing' && accessStatus.daysLeft !== 0 && !(accessStatus.daysLeft === undefined && subscription?.trial_end && new Date(subscription.trial_end) <= new Date()) ? 'Trial Ends' : 'Next Billing'}
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
            {subscription.status === 'trialing' && accessStatus.daysLeft !== undefined && accessStatus.daysLeft > 0 && (
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

            {/* Cancellation notice - only for status='canceled' (not cancel_at_period_end, which has its own card) */}
            {subscription.status === 'canceled' && !subscription.cancel_at_period_end && accessStatus.daysLeft !== undefined && (
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
            
            {(subscription.status === 'active' || subscription.status === 'trialing') && !subscription.cancel_at_period_end && (
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