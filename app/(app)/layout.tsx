import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Tables } from '@/types/supabase';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shared/app-sidebar';
import { GlobalSubscriptionBanner } from '@/components/shared/global-subscription-banner';
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { Toaster } from '@/components/ui/sonner';

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

  if (!profile) {
    return redirect('/sign-in');
  }

  const userWithEmail = {
    ...profile,
    email: user.email || ''
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

  // Get sidebar state from cookies for persistence
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get('sidebar:state')?.value !== 'false'; // Default to true (open)

  return (
    <SubscriptionProvider initialSubscription={subscription}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar user={userWithEmail as Tables<'profiles'> & { email: string }} />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <GlobalSubscriptionBanner />
            <TrialSuccessBanner />
            <div className="flex-1 max-w-6xl mx-auto w-full">
              {children}
            </div>
          </div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </SubscriptionProvider>
  );
} 