'use client';

import { useSubscription } from '@/components/providers/subscription-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, CreditCard, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface AccessGateProps {
  children: ReactNode;
  feature?: string;
  showUpgrade?: boolean;
  fallback?: ReactNode;
}

export function AccessGate({ 
  children, 
  feature = 'this feature', 
  showUpgrade = true,
  fallback,
}: AccessGateProps) {
  const { accessStatus, isLoading, accessLevel } = useSubscription();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Allow access if user has subscription access
  if (accessStatus.hasAccess) {
    // Show grace period warning if applicable
    if (accessLevel === 'grace' && accessStatus.showBanner) {
      return (
        <div className="space-y-4">
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              {accessStatus.message} Access will be restricted soon.
            </AlertDescription>
          </Alert>
          {children}
        </div>
      );
    }
    
    return <>{children}</>;
  }

  // Show custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show access denied message
  return <AccessDeniedCard feature={feature} showUpgrade={showUpgrade} />;
}

interface AccessDeniedCardProps {
  feature: string;
  showUpgrade: boolean;
}

function AccessDeniedCard({ feature, showUpgrade }: AccessDeniedCardProps) {
  const { accessStatus } = useSubscription();
  
  const getIcon = () => {
    switch (accessStatus.status) {
      case 'no_subscription':
        return <CreditCard className="h-6 w-6 text-gray-600" />;
      case 'access_denied':
        return <Lock className="h-6 w-6 text-red-600" />;
      default:
        return <Clock className="h-6 w-6 text-orange-600" />;
    }
  };

  const getTitle = () => {
    switch (accessStatus.status) {
      case 'no_subscription':
        return 'Start Your Free Trial';
      case 'access_denied':
        return 'Subscription Required';
      default:
        return 'Access Restricted';
    }
  };

  const getDescription = () => {
    return accessStatus.message || `You need an active subscription to access ${feature}.`;
  };

  return (
    <div className="flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-full p-3 w-fit mb-4">
            {getIcon()}
          </div>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription>{getDescription()}</CardDescription>
        </CardHeader>
        
        {showUpgrade && (
          <CardContent className="text-center space-y-3">
            <Button asChild className="w-full">
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                {accessStatus.status === 'no_subscription' ? 'Start Free Trial' : 'Manage Billing'}
              </Link>
            </Button>
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/content">
                Back to Dashboard
              </Link>
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
} 