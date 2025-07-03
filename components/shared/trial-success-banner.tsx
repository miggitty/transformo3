'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function TrialSuccessBanner() {
  const searchParams = useSearchParams();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const trialSetup = searchParams.get('trial_setup');
    if (trialSetup === 'success') {
      setShowBanner(true);
      
      // Remove the query parameter from URL without page reload
      const url = new URL(window.location.href);
      url.searchParams.delete('trial_setup');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  if (!showBanner) return null;

  return (
    <Alert className="mb-6 border-green-200 bg-green-50">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <strong className="text-green-800">Welcome to your 7-day free trial!</strong>
          <p className="text-green-700 mt-1">
            Your trial is active and you have full access to all features. You won&apos;t be charged until your trial ends.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowBanner(false)}
          className="text-green-600 hover:text-green-800 hover:bg-green-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
} 