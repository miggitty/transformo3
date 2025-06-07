import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  // 1. Secure the webhook
  const callbackSecret = process.env.N8N_CALLBACK_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Parse the request body
  const { content_id, transcript, content_title } = await req.json();

  if (!content_id || !transcript || !content_title) {
    return new NextResponse('Missing required fields', { status: 400 });
  }

  // 3. Update the database
  const { error } = await supabase
    .from('content')
    .update({
      transcript: transcript,
      content_title: content_title,
      status: 'completed', // Final status
    })
    .eq('id', content_id);

  if (error) {
    console.error('Error updating content from n8n callback:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // 4. Respond to n8n
  return new NextResponse(null, { status: 204 }); // All good
} 