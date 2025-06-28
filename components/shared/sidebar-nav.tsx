'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  Settings, 
  LayoutGrid, 
  PlusCircle, 
  ChevronDown, 
  ChevronRight,
  Building2,
  Plug,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
  {
    href: '/content',
    label: 'Content',
    icon: LayoutGrid,
  },
  {
    href: '/new',
    label: 'New Content',
    icon: PlusCircle,
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: CreditCard,
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
];

export function SidebarNav() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    return pathname.startsWith('/settings');
  });

  const isSettingsActive = pathname.startsWith('/settings');

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {/* Main navigation items */}
      {navigationItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
              isActive 
                ? "bg-muted text-primary" 
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      {/* Settings collapsible section */}
      <div>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
            isSettingsActive 
              ? "bg-muted text-primary" 
              : "text-muted-foreground"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
          {isSettingsOpen ? (
            <ChevronDown className="ml-auto h-4 w-4" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4" />
          )}
        </button>
        
        {/* Settings submenu */}
        {isSettingsOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:text-primary",
                    isActive 
                      ? "bg-muted text-primary" 
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
} 