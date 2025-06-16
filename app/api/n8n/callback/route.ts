import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('N8N callback received:', {
      headers: Object.fromEntries(request.headers.entries()),
      body: JSON.stringify(body, null, 2)
    });

    // Verify N8N callback secret (following documented pattern)
    const callbackSecret = request.headers.get('x-n8n-callback-secret');
    if (callbackSecret && process.env.N8N_CALLBACK_SECRET && callbackSecret !== process.env.N8N_CALLBACK_SECRET) {
      console.log('N8N callback secret mismatch:', { received: callbackSecret, expected: process.env.N8N_CALLBACK_SECRET });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content_id, transcript, content_title, research, success, error, environment } = body;

    // Log the callback for debugging (following documented pattern)
    console.log(`N8N callback received from ${environment || 'unknown'}:`, {
      content_id,
      success,
      error: error || 'none',
      hasTranscript: !!transcript,
      hasTitle: !!content_title,
      hasResearch: !!research
    });

    if (!content_id) {
      console.error('Missing content_id in callback');
      return NextResponse.json({ error: 'Missing content_id' }, { status: 400 });
    }

    // Handle both success and error cases
    // If success field is not provided but we have transcript and title, assume success
    const isSuccess = success !== false && transcript && content_title;
    
    const updateData: any = {};

    if (isSuccess) {
      // Success case - update with processed data
      updateData.status = 'completed';
      updateData.transcript = transcript;
      updateData.content_title = content_title;
      if (research) {
        updateData.research = research;
      }
      // Clear any previous error
      updateData.error_message = null;
    } else {
      // Error case - only update status and error message
      updateData.status = 'processing'; // Keep as processing rather than unknown 'error' status
      updateData.error_message = error || 'N8N workflow failed without specific error';
    }

    console.log('Updating content with data:', { content_id, updateData });

    // Update content based on N8N callback
    const { data, error: updateError } = await supabase
      .from('content')
      .update(updateData)
      .eq('id', content_id)
      .select();

    if (updateError) {
      console.error('Error updating content:', updateError);
      return NextResponse.json({ 
        error: 'Database update failed', 
        details: updateError.message 
      }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.error('No content found with ID:', content_id);
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    console.log(`Successfully updated content ${content_id} - Status: ${updateData.status}`);
    return NextResponse.json({ success: true, updated: data[0] });
  } catch (error) {
    console.error('N8N callback error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 