import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { BillingPageClient } from '@/components/shared/billing/billing-page-client';

export const metadata = {
  title: 'Billing & Subscription',
  description: 'Manage your subscription and billing settings',
};

export default async function BillingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.business_id) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium">Business Profile Not Found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact support for assistance.
          </p>
        </div>
      </div>
    );
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (error || !business) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h3 className="text-lg font-medium">Error Loading Business Data</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {error?.message || 'Could not load business data'}
          </p>
        </div>
      </div>
    );
  }

  // Get subscription data
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('business_id', profile.business_id)
    .single();



  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing settings
          </p>
        </div>
      </div>
      
      <BillingPageClient 
        business={business}
        subscription={subscription}
      />
    </div>
  );
} 