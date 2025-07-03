import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    urlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0,
    anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length || 0,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    // Show first/last few characters to verify correct keys
    urlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL ? 
      `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(-10)}` : 
      'MISSING',
    anonKeyPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
      `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.slice(-10)}` : 
      'MISSING',
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV
  };

  return NextResponse.json(envVars);
} 