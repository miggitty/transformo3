import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { Tables } from '@/types/supabase';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import AppLayoutClient from '@/components/shared/app-layout-client';

// Force dynamic rendering for this layout
export const dynamic = 'force-dynamic';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/sign-in');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const userWithProfile = {
    ...profile,
    email: user.email!,
  };

  // Get subscription data for the layout
  let subscription = null;
  if (profile?.business_id) {
    const { data, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', profile.business_id)
      .single();
      
    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('Subscription fetch error:', subscriptionError);
    } else {
      subscription = data;
    }
  }

  return (
    <SubscriptionProvider initialSubscription={subscription}>
      <AppLayoutClient user={userWithProfile as Tables<'profiles'> & { email: string }}>
        {children}
      </AppLayoutClient>
    </SubscriptionProvider>
  );
} 