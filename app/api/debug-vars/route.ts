export async function GET() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Log details to the Vercel server-side logs
  console.log('--- Vercel Environment Variable Debug ---');
  console.log(`Variable NEXT_PUBLIC_SUPABASE_URL: ${url ? `Exists and its value is "${url}"` : 'MISSING or undefined'}`);
  console.log(`Variable NEXT_PUBLIC_SUPABASE_ANON_KEY: ${anonKey ? `Exists and its length is ${anonKey.length}` : 'MISSING or undefined'}`);
  console.log('-------------------------------------------');

  // Return a public confirmation to the browser
  return Response.json({
    url_status: url ? 'Found' : 'MISSING',
    key_status: anonKey ? 'Found' : 'MISSING',
    url_value: url || 'undefined',
    key_length: anonKey ? anonKey.length : 0,
  });
} 