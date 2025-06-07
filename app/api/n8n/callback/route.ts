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
  const { data, error } = await supabase
    .from('content')
    .update({
      transcript: transcript,
      content_title: content_title,
      status: 'completed', // Final status
    })
    .eq('id', content_id)
    .select();

  if (error) {
    console.error('Error updating content from n8n callback:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  // Add a new check to ensure a row was actually updated
  if (!data || data.length === 0) {
    console.error(
      'N8N callback: Update succeeded but no row was found for content_id:',
      content_id
    );
    return new NextResponse(
      JSON.stringify({ error: 'No content found with the provided ID.' }),
      {
        status: 404, // Not Found is more appropriate
      }
    );
  }

  // 4. Respond to n8n
  console.log('Successfully updated content from n8n callback:', content_id);
  return new NextResponse(null, { status: 204 }); // All good
} 