import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, status, secret } = body;

    // Verify the secret to ensure only N8N can call this
    if (secret !== process.env.N8N_CALLBACK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!content_id || !status) {
      return NextResponse.json({ error: 'Missing content_id or status' }, { status: 400 });
    }

    // Validate status values
    const validStatuses = ['processing', 'draft', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const supabase = await createClient();
    
    const { error } = await supabase
      .from('content')
      .update({ status })
      .eq('id', content_id);

    if (error) {
      console.error('Error updating content status:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Content ${content_id} status updated to ${status}` 
    });

  } catch (error) {
    console.error('Error in update-status API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 