import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateWebhookRequest } from '@/lib/webhook-security';

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const body = await request.json();
    
    // Use HMAC signature validation if available, fallback to simple secret for compatibility
    const webhookSignature = request.headers.get('x-webhook-signature');
    const n8nCallbackSecret = process.env.N8N_CALLBACK_SECRET;
    
    if (!n8nCallbackSecret) {
      console.error('N8N_CALLBACK_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    if (webhookSignature) {
      // Use HMAC signature validation for enhanced security
      const validation = await validateWebhookRequest(request, body, n8nCallbackSecret);
      if (!validation.valid) {
        console.error('Webhook signature validation failed:', validation.error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } else {
      // Fallback to simple secret validation for backward compatibility
      const callbackSecret = request.headers.get('x-n8n-callback-secret');
      if (callbackSecret !== n8nCallbackSecret) {
        console.error('Unauthorized callback attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    console.log('N8N callback received:', body);

    const { 
      content_id, 
      content_asset_id,
      success, 
      error: workflowError 
    } = body;

    // Initialize Supabase client with service role key for N8N callbacks (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration for N8N callback');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );

    // Handle different types of callbacks
    
    // Handle image regeneration callbacks (identified by presence of image_url + content_asset_id)
    if (body.image_url && content_asset_id) {
      console.log(`Processing image regeneration callback for asset ${content_asset_id}`);
      console.log(`New image URL: ${body.image_url}`);
      
      // Store the new image URL in temporary_image_url field for user approval
      // Do NOT update image_url directly - that happens only when user chooses to save
      const { error: updateError } = await supabase
        .from('content_assets')
        .update({ 
          temporary_image_url: body.image_url
        })
        .eq('id', content_asset_id);

      if (updateError) {
        console.error('Error updating content asset temporary image:', updateError);
        return NextResponse.json({ error: 'Failed to store temporary image' }, { status: 500 });
      }

      console.log('Image regeneration callback processed successfully - stored in temporary_image_url');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Temporary image stored for user approval' 
      });
    }

    // Handle content processing callbacks (audio/video/content creation)
    if (content_id) {
      const newStatus = success ? 'draft' : 'failed';
      
      console.log(`Updating content ${content_id} status to ${newStatus}`);

      const { error: updateError } = await supabase
        .from('content')
        .update({ 
          status: newStatus,
          error_message: success ? null : (workflowError || 'Workflow failed')
        })
        .eq('id', content_id);

      if (updateError) {
        console.error('Error updating content status:', updateError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log(`Successfully updated content ${content_id} to ${newStatus}`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Content ${content_id} status updated to ${newStatus}` 
      });
    }

    // If we get here, we don't know how to handle this callback
    console.warn('Unknown callback type received:', body);
    return NextResponse.json({ 
      success: true, 
      message: 'Callback received but no action taken' 
    });

  } catch (error) {
    console.error('Error in N8N callback:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 