'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createTrialSubscriptionSetup } from '@/app/actions/billing';
import { calculateYearlySavings, AccessCheckResult } from '@/lib/subscription';
import { Tables } from '@/types/supabase';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check, Sparkles, Star } from 'lucide-react';

interface PlanSelectionCardProps {
  business: Tables<'businesses'>;
  subscription?: Tables<'subscriptions'> | null;
  accessStatus?: AccessCheckResult;
}

export function PlanSelectionCard({ subscription, accessStatus }: PlanSelectionCardProps) {
  const [isLoadingTrial, setIsLoadingTrial] = useState(false);
  const [isLoadingMonthly] = useState(false);
  const [isLoadingYearly] = useState(false);
  
  const { savings, percentSavings } = calculateYearlySavings();

  const handleTrialSetup = async () => {
    setIsLoadingTrial(true);
    try {
      const result = await createTrialSubscriptionSetup();
      if (result.success && result.url) {
        // Redirect to Stripe Checkout for trial setup
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to start trial setup');
      }
    } catch (error) {
      console.error('Trial setup error:', error);
      toast.error('Failed to start trial setup');
    } finally {
      setIsLoadingTrial(false);
    }
  };

  // Unused for now but kept for future enhancement
  // const handlePlanSelection = async (plan: 'monthly' | 'yearly') => {
  //   const setLoading = plan === 'monthly' ? setIsLoadingMonthly : setIsLoadingYearly;
  //   
  //   setLoading(true);
  //   try {
  //     const result = await createCheckoutSession(plan);
  //     if (result.success && result.url) {
  //       // Redirect to Stripe Checkout
  //       window.location.href = result.url;
  //     } else {
  //       toast.error(result.error || 'Failed to create checkout session');
  //     }
  //   } catch (error) {
  //     console.error('Checkout error:', error);
  //     toast.error('Failed to create checkout session');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const features = [
    'Unlimited content generation',
    'AI-powered video creation with HeyGen',
    'Multi-platform publishing automation',
    'Advanced analytics and insights',
    'Priority customer support',
    'Custom branding options',
    'Team collaboration tools',
    'API access for integrations',
  ];

  const isLoading = isLoadingTrial || isLoadingMonthly || isLoadingYearly;
  const hasActiveSubscription = subscription && ['trialing', 'active'].includes(subscription.status) && !subscription.cancel_at_period_end;
  // const currentPlan = subscription?.price_id; // Unused for now

  // If user has a canceled subscription, don't show this card at all
  if (subscription?.cancel_at_period_end) {
    return null;
  }

  // If user has an active subscription, show current plan status
  if (hasActiveSubscription) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            <CardTitle>Current Plan</CardTitle>
          </div>
          <CardDescription>
            You have an active subscription. Use the subscription status card above to manage your billing.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="text-center p-6 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Check className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-900 dark:text-green-100">
                {subscription?.status === 'trialing' && accessStatus?.daysLeft && accessStatus.daysLeft > 0 ? 'Free Trial Active' : 'Subscription Active'}
              </span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300">
              {subscription?.status === 'trialing' && accessStatus?.daysLeft && accessStatus.daysLeft > 0
                ? 'Enjoying your free trial? Your subscription will start automatically when the trial ends.'
                : 'Thank you for subscribing! You have access to all features.'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Choose Your Plan</CardTitle>
        </div>
        <CardDescription>
          Start with a 7-day free trial. Add your payment method to get started - you won&apos;t be charged until your trial ends.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Features List */}
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            What&apos;s included:
          </h4>
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
          <div className="border rounded-lg p-4 space-y-4 relative hover:border-primary/50 transition-colors">
            <div>
              <h3 className="font-semibold text-lg">Monthly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold">$199</span>
                <span className="text-sm text-muted-foreground">per month</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Billed monthly &bull; Cancel anytime
              </p>
            </div>
            
            <Button 
              onClick={handleTrialSetup}
              disabled={isLoading}
              className="w-full"
              variant="outline"
            >
              {isLoadingTrial ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Free Trial
            </Button>
          </div>

          {/* Yearly Plan */}
          <div className="border rounded-lg p-4 space-y-4 relative hover:border-primary/50 transition-colors">
            <Badge className="absolute -top-2 left-4 bg-green-600 hover:bg-green-700">
              Save {percentSavings}% (${savings})
            </Badge>
            
            <div>
              <h3 className="font-semibold text-lg">Yearly Plan</h3>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold">$1,990</span>
                <span className="text-sm text-muted-foreground">per year</span>
              </div>
              <p className="text-xs text-green-600 font-medium">
                ${Math.round(1990/12)} per month &bull; 2 months free
              </p>
            </div>
            
            <Button 
              onClick={handleTrialSetup}
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isLoadingTrial ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Start Free Trial
            </Button>
          </div>
        </div>

        {/* Trial Information */}
        <div className="text-center space-y-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <p className="font-medium">🎉 7-Day Free Trial</p>
            <p>
              Add payment method but no charges during trial &bull; Full access to all features &bull; Cancel anytime
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            After your trial ends, you&apos;ll be charged based on your selected plan.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
 