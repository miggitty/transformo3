import type { NextConfig } from "next";
import withPWA from 'next-pwa';

// Define the PWA options
const pwaConfig = {
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
};

// Helper function to get Supabase hostname from URL
const getSupabaseHostname = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

// Get the current Supabase URL and extract hostname
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mmodhofduvuyifwlsrmh.supabase.co';
const supabaseHostname = getSupabaseHostname(supabaseUrl);

// Build image patterns based on environment
const getImagePatterns = () => {
  const patterns = [];
  
  // Always add the current Supabase instance
  if (supabaseHostname) {
    patterns.push({
      protocol: 'https' as const,
      hostname: supabaseHostname,
      port: '',
      pathname: '/storage/v1/object/**',
    });
  }
  
  // Add zrok patterns only in development
  if (process.env.NODE_ENV === 'development') {
    patterns.push({
      protocol: 'https' as const,
      hostname: '*.share.zrok.io',
      port: '',
      pathname: '/storage/v1/object/**',
    });
  }
  
  // Fallback for production remote instance (if different from current)
  patterns.push({
    protocol: 'https' as const,
    hostname: 'mmodhofduvuyifwlsrmh.supabase.co',
    port: '',
    pathname: '/storage/v1/object/**',
  });
  
  return patterns;
};

// Define the main Next.js configuration
const nextConfig: NextConfig = {
  images: {
    remotePatterns: getImagePatterns(),
  },
};

// Wrap the Next.js config with the PWA config
export default withPWA(pwaConfig)(nextConfig);
