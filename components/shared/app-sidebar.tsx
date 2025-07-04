'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useState } from 'react';
import { 
  Settings, 
  LayoutGrid, 
  ChevronDown,
  Building2,
  Plug,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  RotateCcw,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewContentButton } from '@/components/shared/new-content-button';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(auth)/actions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tables } from '@/types/supabase';

const contentItems = [
  {
    href: '/content/drafts',
    label: 'Drafts',
    icon: FileText,
  },
  {
    href: '/content/scheduled',
    label: 'Scheduled',
    icon: Clock,
  },
  {
    href: '/content/partially-published',
    label: 'Partially Published',
    icon: RotateCcw,
  },
  {
    href: '/content/completed',
    label: 'Completed',
    icon: CheckCircle,
  },
];

const settingsItems = [
  {
    href: '/settings/business',
    label: 'Business Settings',
    icon: Building2,
  },
  {
    href: '/settings/integrations',
    label: 'Integrations',
    icon: Plug,
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: CreditCard,
  },
];

interface AppSidebarProps {
  user: Tables<'profiles'> & { email: string };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    return pathname.startsWith('/settings') || pathname === '/billing';
  });
  const [isContentOpen, setIsContentOpen] = useState(() => {
    return true; // Always open Content section by default
  });

  const isSettingsActive = pathname.startsWith('/settings') || pathname === '/billing';
  const isContentActive = pathname.startsWith('/content');

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <div className="flex h-16 items-center px-4 lg:px-6">
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
      </SidebarHeader>
      
      <SidebarContent className="py-4">
        <SidebarGroup className="px-3">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <NewContentButton 
                  variant="default" 
                  className="w-full justify-start h-10"
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-3 pt-4">
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={true} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        "w-full h-10",
                        isContentActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      <span>Content</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-2">
                      {contentItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActive} className="h-9">
                              <Link href={item.href}>
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-3 pt-2">
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={isSettingsOpen} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        "w-full h-10",
                        isSettingsActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="ml-4 mt-2">
                      {settingsItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href;
                        
                        return (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton asChild isActive={isActive} className="h-9">
                              <Link href={item.href}>
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-t px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="h-12">
              <div className="flex items-center gap-3 px-2 py-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-medium truncate">{user.email}</div>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOut} className="w-full">
              <SidebarMenuButton type="submit" className="w-full h-10 text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
} 