'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X, CreditCard, Calendar } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionBannerProps {
  message: string;
  type: 'trial' | 'grace_period' | 'expired';
  daysLeft?: number;
}

export function SubscriptionBanner({ message, type, daysLeft }: SubscriptionBannerProps) {
  const getBannerConfig = () => {
    switch (type) {
      case 'trial':
        return {
          className: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
          icon: <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
          textColor: 'text-blue-800 dark:text-blue-200',
          badgeVariant: 'secondary' as const,
          actionButton: daysLeft && daysLeft <= 3 ? (
            <Button size="sm" asChild>
              <Link href="/billing">
                Upgrade Now
              </Link>
            </Button>
          ) : null,
        };
      case 'grace_period':
        return {
          className: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950',
          icon: <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />,
          textColor: 'text-orange-800 dark:text-orange-200',
          badgeVariant: 'destructive' as const,
          actionButton: (
            <Button size="sm" variant="outline" asChild>
              <Link href="/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment
              </Link>
            </Button>
          ),
        };
      case 'expired':
        return {
          className: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
          icon: <X className="h-4 w-4 text-red-600 dark:text-red-400" />,
          textColor: 'text-red-800 dark:text-red-200',
          badgeVariant: 'destructive' as const,
          actionButton: (
            <Button size="sm" asChild>
              <Link href="/billing">
                Reactivate
              </Link>
            </Button>
          ),
        };
      default:
        return {
          className: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900',
          icon: <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />,
          textColor: 'text-gray-800 dark:text-gray-200',
          badgeVariant: 'secondary' as const,
          actionButton: null,
        };
    }
  };

  const config = getBannerConfig();

  return (
    <Alert className={config.className}>
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center space-x-3 flex-1">
          {config.icon}
          <div className="flex-1">
            <AlertDescription className={`${config.textColor} font-medium`}>
              {message}
            </AlertDescription>
          </div>
          {daysLeft !== undefined && (
            <Badge variant={config.badgeVariant} className="ml-auto mr-2">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
            </Badge>
          )}
        </div>
        {config.actionButton && (
          <div className="ml-4">
            {config.actionButton}
          </div>
        )}
      </div>
    </Alert>
  );
} 