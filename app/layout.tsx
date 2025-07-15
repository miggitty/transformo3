import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Script from 'next/script';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import SupabaseProvider from '@/components/providers/supabase-provider';

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'Next.js and Supabase Starter Kit',
  description: 'The fastest way to build apps with Next.js and Supabase',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="bg-background text-foreground" suppressHydrationWarning>
        <SupabaseProvider>
          <main className="min-h-screen flex flex-col items-center">
            {children}
          </main>
          <Toaster />
        </SupabaseProvider>
        
        {/* HelpScout Beacon Chat Bot */}
        <Script id="helpscout-beacon-loader" strategy="afterInteractive">
          {`
            !function(e,t,n){function a(){var e=t.getElementsByTagName("script")[0],n=t.createElement("script");n.type="text/javascript",n.async=!0,n.src="https://beacon-v2.helpscout.net",e.parentNode.insertBefore(n,e)}if(e.Beacon=n=function(t,n,a){e.Beacon.readyQueue.push({method:t,options:n,data:a})},n.readyQueue=[],"complete"===t.readyState)return a();e.attachEvent?e.attachEvent("onload",a):e.addEventListener("load",a,!1)}(window,document,window.Beacon||function(){});
          `}
        </Script>
        
        <Script id="helpscout-beacon-init" strategy="afterInteractive">
          {`
            window.Beacon('init', '96811c92-3f05-43e6-8604-147753e4d28e');
          `}
        </Script>
      </body>
    </html>
  );
}
