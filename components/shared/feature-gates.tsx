'use client';

import { useContentAccess, useIntegrationAccess, useAnalyticsAccess } from '@/hooks/use-feature-access';
import { AccessGate } from '@/components/shared/access-gate';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReactNode } from 'react';
import { Lock, Zap, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface ContentGateProps {
  children: ReactNode;
  action?: 'create' | 'edit' | 'delete';
}

export function ContentGate({ children, action = 'create' }: ContentGateProps) {
  const access = useContentAccess();
  
  if (action === 'delete' && !access.canDelete) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription>
          Content deletion is available for active subscribers only.
          <Button variant="link" className="p-0 h-auto ml-2" asChild>
            <Link href="/billing">Upgrade Now</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (action === 'create' && access.maxItems && access.maxItems <= 10) {
    return (
      <div className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Trial users can create up to {access.maxItems} content items.</span>
            <Badge variant="secondary">Trial</Badge>
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}

interface IntegrationGateProps {
  children: ReactNode;
  showLimits?: boolean;
}

export function IntegrationGate({ children, showLimits = true }: IntegrationGateProps) {
  const access = useIntegrationAccess();
  
  if (!access.canConnect) {
    return (
      <AccessGate 
        feature="integrations"
        fallback={
          <div className="text-center py-8">
            <div className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-full p-3 w-fit mb-4">
              <Lock className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium">Integration Access Required</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Connect external services with an active subscription.
            </p>
            <Button className="mt-4" asChild>
              <Link href="/billing">Start Free Trial</Link>
            </Button>
          </div>
        }
      >
        {children}
      </AccessGate>
    );
  }

  if (showLimits && access.maxIntegrations && access.maxIntegrations === 1) {
    return (
      <div className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <Zap className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Trial users can connect up to {access.maxIntegrations} integration.</span>
            <Badge variant="secondary">Trial Limit</Badge>
          </AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  return <>{children}</>;
}

interface AnalyticsGateProps {
  children: ReactNode;
  level?: 'basic' | 'advanced' | 'export';
}

export function AnalyticsGate({ children, level = 'basic' }: AnalyticsGateProps) {
  const access = useAnalyticsAccess();
  
  if (level === 'basic' && !access.canViewBasic) {
    return (
      <AccessGate 
        feature="analytics"
        fallback={
          <div className="text-center py-8">
            <div className="mx-auto bg-gray-100 dark:bg-gray-800 rounded-full p-3 w-fit mb-4">
              <BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
            <h3 className="text-lg font-medium">Analytics Access Required</h3>
            <p className="text-sm text-muted-foreground mt-1">
              View analytics and insights with an active subscription.
            </p>
          </div>
        }
      >
        {children}
      </AccessGate>
    );
  }

  if (level === 'advanced' && !access.canViewAdvanced) {
    return (
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          Advanced analytics are available for active subscribers only.
          <Button variant="link" className="p-0 h-auto ml-2" asChild>
            <Link href="/billing">Upgrade Now</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (level === 'export' && !access.canExport) {
    return (
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertDescription>
          Data export is available for active subscribers only.
          <Button variant="link" className="p-0 h-auto ml-2" asChild>
            <Link href="/billing">Upgrade Now</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
} 