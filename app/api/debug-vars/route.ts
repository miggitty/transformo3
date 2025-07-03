import { NextResponse } from 'next/server';

export async function GET() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Log details to the Vercel server-side logs
  console.log('--- Vercel Environment Variable Debug ---');
  console.log(`Variable NEXT_PUBLIC_SUPABASE_URL: ${url ? `Exists and its value is "${url}"` : 'MISSING or undefined'}`);
  console.log(`Variable NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? `Exists and its length is ${anonKey.length}` : 'MISSING or undefined'}`);
  console.log('-------------------------------------------');

  // Return a public confirmation to the browser
  return NextResponse.json({
    url_status: url ? 'Found' : 'Missing',
    key_status: anonKey ? 'Found' : 'Missing',
    url_value: url,
    key_length: anonKey ? anonKey.length : 0,
    app_url_status: process.env.NEXT_PUBLIC_APP_URL ? 'Found' : 'Missing',
    app_url_value: process.env.NEXT_PUBLIC_APP_URL,
  });
} 