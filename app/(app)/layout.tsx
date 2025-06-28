import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(auth)/actions';
import { LogOut } from 'lucide-react';
import { Tables } from '@/types/supabase';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { SubscriptionProvider } from '@/components/providers/subscription-provider';
import { GlobalSubscriptionBanner } from '@/components/shared/global-subscription-banner';

async function Sidebar({
  user,
}: {
  user: Tables<'profiles'> & { email: string };
}) {
  return (
    <div className="hidden border-r bg-muted/40 md:block">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/content" className="flex items-center gap-2 font-semibold">
            <Image
              src="/transformo-logo.webp"
              alt="Transformo Logo"
              width={120}
              height={30}
              className="h-auto w-auto"
            />
          </Link>
        </div>
        <div className="flex-1">
          <SidebarNav />
        </div>
        <div className="mt-auto p-4">
          <div className="mb-2 border-t pt-4">
            <div className="text-sm text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
          <form action={signOut}>
            <Button variant="ghost" className="w-full justify-start">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

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
      <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar
          user={userWithProfile as Tables<'profiles'> & { email: string }}
        />
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            <main className="mx-auto max-w-4xl flex-1">{children}</main>
          </div>
        </div>
      </div>
    </SubscriptionProvider>
  );
} 