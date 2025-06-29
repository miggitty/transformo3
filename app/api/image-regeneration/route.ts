import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

// Rate limiting: 5 images per 10 minutes per business
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

interface RegenerationRequest {
  content_asset_id: string;
  image_prompt: string;
}

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with service role key
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables for Supabase');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    // Parse request body
    const body: RegenerationRequest = await request.json();
    const { content_asset_id, image_prompt } = body;

    // Validate input
    if (!content_asset_id || !image_prompt?.trim()) {
      return NextResponse.json({ 
        error: 'Missing required fields: content_asset_id and image_prompt' 
      }, { status: 400 });
    }

    // Get content asset with business information for rate limiting
    const { data: contentAsset, error: fetchError } = await supabase
      .from('content_assets')
      .select(`
        id,
        content_id,
        content_type,
        image_url,
        image_prompt,
        content:content_id (
          business_id,
          businesses:business_id (
            id,
            business_name
          )
        )
      `)
      .eq('id', content_asset_id)
      .single();

    if (fetchError || !contentAsset) {
      console.error('Error fetching content asset:', fetchError);
      return NextResponse.json({ 
        error: 'Content asset not found' 
      }, { status: 404 });
    }

    // Type assertion and safe access for nested data
    const content = contentAsset.content as any;
    const business = content?.businesses as any;
    const businessId = business?.id;
    
    if (!businessId) {
      return NextResponse.json({ 
        error: 'Business information not found for content asset' 
      }, { status: 400 });
    }

    // Rate limiting check (only if enabled)
    const rateLimitEnabled = process.env.ENABLE_IMAGE_REGENERATION_RATE_LIMIT === 'true';
    
    if (rateLimitEnabled) {
      console.log('Rate limiting enabled - checking limits');
      const tenMinutesAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
      
      // First get all content IDs for this business
      const { data: businessContent, error: businessContentError } = await supabase
        .from('content')
        .select('id')
        .eq('business_id', businessId);

      if (businessContentError) {
        console.error('Error fetching business content:', businessContentError);
      } else if (businessContent && businessContent.length > 0) {
        const contentIds = businessContent.map(c => c.id);
        
        // Count image regenerations for this business's content
        const { count, error: countError } = await supabase
          .from('content_assets')
          .select('id', { count: 'exact' })
          .in('content_id', contentIds)
          .gte('created_at', tenMinutesAgo)
          .not('image_url', 'is', null);

        if (countError) {
          console.error('Error checking rate limit:', countError);
        } else if (count && count >= RATE_LIMIT_COUNT) {
          return NextResponse.json({ 
            error: `Rate limit exceeded. You can only regenerate ${RATE_LIMIT_COUNT} images every 10 minutes. Please try again later.` 
          }, { status: 429 });
        }
        
        console.log(`Rate limit check passed: ${count}/${RATE_LIMIT_COUNT} requests used`);
      }
    } else {
      console.log('Rate limiting disabled - skipping rate limit check');
    }

    // Check for N8N webhook URL
    const webhookUrl = process.env.N8N_WEBHOOK_IMAGE_REGENERATION;
    if (!webhookUrl) {
      console.error('N8N_WEBHOOK_IMAGE_REGENERATION is not configured');
      return NextResponse.json({ 
        error: 'Image regeneration service not configured' 
      }, { status: 500 });
    }

    // Prepare payload for N8N workflow
    const n8nPayload = {
      content_asset_id: contentAsset.id,
      content_id: contentAsset.content_id,
      content_type: contentAsset.content_type,
      image_prompt: image_prompt.trim(),
      business_id: businessId,
      business_name: business?.business_name || 'Unknown',
      // Callback information
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
      callbackSecret: process.env.N8N_CALLBACK_SECRET,
      environment: process.env.NODE_ENV,
      workflow_type: 'image_regeneration'
    };

    console.log('Triggering N8N image regeneration workflow:', {
      content_asset_id: contentAsset.id,
      content_type: contentAsset.content_type,
      business_id: businessId,
      webhook_url: webhookUrl
    });

    // Call N8N webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(n8nPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`N8N webhook failed [${response.status}]:`, errorText);
      return NextResponse.json({ 
        error: 'Failed to start image regeneration. Please try again.' 
      }, { status: 500 });
    }

    // Update the content asset with the new prompt immediately
    const { error: updateError } = await supabase
      .from('content_assets')
      .update({
        image_prompt: image_prompt.trim()
      })
      .eq('id', content_asset_id);

    if (updateError) {
      console.error('Error updating image prompt:', updateError);
      // Don't fail the request, just log the error
    }

    console.log('Successfully triggered image regeneration workflow');

    return NextResponse.json({ 
      success: true,
      message: 'Image regeneration started',
      content_asset_id: contentAsset.id
    });

  } catch (error) {
    console.error('Image regeneration API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 