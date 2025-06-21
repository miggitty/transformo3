import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function BillingSuccessPage() {
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
          <div className="mx-auto bg-green-100 rounded-full p-3 w-fit mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Welcome to Transformo!</CardTitle>
          <CardDescription>
            Your subscription has been activated successfully. Your 7-day free trial has started.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              You now have full access to all Transformo features. Start creating amazing content!
            </p>
            
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full">
                <Link href="/new">
                  Start Creating Content
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/billing">
                  View Billing Details
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 