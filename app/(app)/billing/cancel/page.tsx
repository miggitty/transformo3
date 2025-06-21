import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default async function BillingCancelPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  return (
    <div className="flex items-center justify-center min-h-[600px] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-gray-100 rounded-full p-3 w-fit mb-4">
            <XCircle className="h-8 w-8 text-gray-600" />
          </div>
          <CardTitle className="text-2xl">Subscription Setup Canceled</CardTitle>
          <CardDescription>
            No worries! You can start your subscription anytime.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your checkout was canceled. You can try again whenever you&apos;re ready to unlock all Transformo features.
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/billing">
                  Try Again
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/content">
                  Back to Content
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 