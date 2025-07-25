import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { validateWebhookRequest } from '@/lib/webhook-security';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, status, secret } = body;

    const n8nCallbackSecret = process.env.N8N_CALLBACK_SECRET;
    if (!n8nCallbackSecret) {
      console.error('N8N_CALLBACK_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Use HMAC signature validation if available, fallback to simple secret
    const webhookSignature = request.headers.get('x-webhook-signature');
    
    if (webhookSignature) {
      // Use HMAC signature validation for enhanced security
      const validation = await validateWebhookRequest(request, body, n8nCallbackSecret);
      if (!validation.valid) {
        console.error('Webhook signature validation failed:', validation.error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else if (secret !== n8nCallbackSecret) {
      // Fallback to simple secret validation
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