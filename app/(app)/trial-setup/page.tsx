'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createTrialSubscriptionSetup } from '@/app/actions/billing';
import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle, CreditCard, Shield, Zap } from 'lucide-react';
import Image from 'next/image';

export default function TrialSetupPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleStartTrial = async () => {
    setIsLoading(true);
    try {
      const result = await createTrialSubscriptionSetup();
      
      if (result.success && result.url) {
        // Redirect to Stripe Checkout
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Failed to start trial setup');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Trial setup error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-8">
      <Image
        src="/transformo-logo.webp"
        alt="Transformo Logo"
        width={200}
        height={50}
        className="h-auto w-auto"
      />
      
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              7-Day Free Trial
            </Badge>
          </div>
          <CardTitle className="text-2xl">Start Your Free Trial</CardTitle>
          <CardDescription>
            Get full access to Transformo for 7 days. Add your payment method to get started.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="text-sm">Full access to all features</span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="text-sm">Unlimited content creation</span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="text-sm">No charges for 7 days</span>
            </div>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-green-600 flex-shrink-0" />
              <span className="text-sm">Cancel anytime during trial</span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>What happens next:</strong> You&apos;ll add a payment method but won&apos;t be charged until your 7-day trial ends. You can cancel anytime during the trial period.
            </p>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={handleStartTrial} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Setting up your trial...' : 'Start 7-Day Free Trial'}
          </Button>
        </CardFooter>
      </Card>
      
      <p className="text-xs text-gray-500 text-center max-w-md">
        By continuing, you agree to our Terms of Service and Privacy Policy. 
        Your trial will automatically convert to a paid subscription unless canceled.
      </p>
    </div>
  );
} 