'use client';

import { useEffect } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/shared/app-sidebar';
import { GlobalSubscriptionBanner } from '@/components/shared/global-subscription-banner';
import { TrialSuccessBanner } from '@/components/shared/trial-success-banner';
import { Toaster } from '@/components/ui/sonner';
import { Tables } from '@/types/supabase';

interface SidebarLayoutWrapperProps {
  children: React.ReactNode;
  user: Tables<'profiles'> & { email: string };
}

export function SidebarLayoutWrapper({ children, user }: SidebarLayoutWrapperProps) {
  useEffect(() => {
    // Clear any existing sidebar state cookie to ensure fresh start on every login
    document.cookie = 'sidebar_state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }, []);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar user={user} />
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
  );
} 