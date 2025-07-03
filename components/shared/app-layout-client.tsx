'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/(auth)/actions';
import { LogOut, Menu, X } from 'lucide-react';
import { Tables } from '@/types/supabase';
import { SidebarNav } from '@/components/shared/sidebar-nav';
import { useState, useEffect } from 'react';

function MobileSidebar({
  user,
  isOpen,
  onClose,
}: {
  user: Tables<'profiles'> & { email: string };
  isOpen: boolean;
  onClose: () => void;
}) {
  // Close mobile menu when clicking outside or on links
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-background border-r z-50 md:hidden transform transition-transform duration-300 ease-in-out">
        <div className="flex h-full max-h-screen flex-col gap-2">
          {/* Header with close button */}
          <div className="flex h-14 items-center justify-between border-b px-4">
            <Link href="/content" className="flex items-center gap-2 font-semibold" onClick={onClose}>
              <Image
                src="/transformo-logo.webp"
                alt="Transformo Logo"
                width={120}
                height={30}
                className="h-auto w-auto"
              />
            </Link>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Navigation */}
          <div className="flex-1" onClick={onClose}>
            <SidebarNav />
          </div>
          
          {/* User section */}
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
    </>
  );
}

function DesktopSidebar({
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

export default function AppLayoutClient({
  children,
  user,
}: {
  children: React.ReactNode;
  user: Tables<'profiles'> & { email: string };
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Desktop Sidebar */}
      <DesktopSidebar user={user} />
      
      {/* Mobile Sidebar */}
      <MobileSidebar 
        user={user} 
        isOpen={mobileMenuOpen} 
        onClose={() => setMobileMenuOpen(false)} 
      />
      
      {/* Main Content Area */}
      <div className="flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="flex h-14 items-center border-b px-4 md:hidden">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/content" className="flex items-center gap-2 font-semibold ml-4">
            <Image
              src="/transformo-logo.webp"
              alt="Transformo Logo"
              width={120}
              height={30}
              className="h-auto w-auto"
            />
          </Link>
        </div>
        
        {/* Content Area with standardized width */}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          <main className="mx-auto max-w-6xl flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
} 