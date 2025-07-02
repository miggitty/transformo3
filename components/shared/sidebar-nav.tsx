'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  Settings, 
  LayoutGrid, 
  ChevronDown, 
  ChevronRight,
  Building2,
  Plug,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NewContentButton } from '@/components/shared/new-content-button';

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

export function SidebarNav() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    return pathname.startsWith('/settings') || pathname === '/billing';
  });
  const [isContentOpen, setIsContentOpen] = useState(() => {
    return pathname.startsWith('/content');
  });

  const isSettingsActive = pathname.startsWith('/settings') || pathname === '/billing';
  const isContentActive = pathname.startsWith('/content');

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {/* New Content Button with Dropdown */}
      <div className="mb-2">
        <NewContentButton 
          variant="default" 
          className="w-full justify-start"
        />
      </div>

      {/* Content collapsible section */}
      <div>
        <button
          onClick={() => setIsContentOpen(!isContentOpen)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
            isContentActive 
              ? "bg-muted text-primary" 
              : "text-muted-foreground"
          )}
        >
          <LayoutGrid className="h-4 w-4" />
          Content
          {isContentOpen ? (
            <ChevronDown className="ml-auto h-4 w-4" />
          ) : (
            <ChevronRight className="ml-auto h-4 w-4" />
          )}
        </button>
        
        {/* Content submenu */}
        {isContentOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {contentItems.map((item) => {
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