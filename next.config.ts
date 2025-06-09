import type { NextConfig } from "next";
import withPWA from 'next-pwa';

// Define the PWA options
const pwaConfig = {
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
};

// Define the main Next.js configuration
const nextConfig: NextConfig = {
  // Your Next.js config options go here.
  // For example:
  // reactStrictMode: true,
};

// Wrap the Next.js config with the PWA config
export default withPWA(pwaConfig)(nextConfig);
