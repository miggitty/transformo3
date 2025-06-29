import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ 
        error: 'Content asset ID is required' 
      }, { status: 400 });
    }

    // Get content asset including temporary_image_url
    const { data: contentAsset, error: fetchError } = await supabase
      .from('content_assets')
      .select(`
        id,
        content_id,
        content_type,
        image_url,
        temporary_image_url,
        image_prompt,
        headline,
        content,
        created_at
      `)
      .eq('id', id)
      .single();

    if (fetchError || !contentAsset) {
      console.error('Error fetching content asset:', fetchError);
      return NextResponse.json({ 
        error: 'Content asset not found' 
      }, { status: 404 });
    }

    return NextResponse.json(contentAsset);

  } catch (error) {
    console.error('Content asset fetch error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ 
        error: 'Content asset ID is required' 
      }, { status: 400 });
    }

    // Extract allowed fields for update
    const { image_url, image_prompt, use_temporary_image, cancel_temporary_image } = body;
    const updateData: Record<string, unknown> = {};

    // Handle using temporary image (move from temporary_image_url to image_url)
    if (use_temporary_image) {
      // First, get the temporary image URL
      const { data: currentAsset, error: fetchError } = await supabase
        .from('content_assets')
        .select('temporary_image_url')
        .eq('id', id)
        .single();

      if (fetchError || !currentAsset) {
        return NextResponse.json({ 
          error: 'Content asset not found' 
        }, { status: 404 });
      }

      if (!currentAsset.temporary_image_url) {
        return NextResponse.json({ 
          error: 'No temporary image available to use' 
        }, { status: 400 });
      }

      // Move temporary image to permanent image_url and clear temporary
      updateData.image_url = currentAsset.temporary_image_url;
      updateData.temporary_image_url = null;
      
      console.log(`Moving temporary image to permanent for content asset ${id}:`, currentAsset.temporary_image_url);
    } 
    // Handle canceling temporary image (just clear it)
    else if (cancel_temporary_image) {
      updateData.temporary_image_url = null;
      console.log(`Canceling temporary image for content asset ${id}`);
    }
    // Handle regular image_url update
    else if (image_url !== undefined) {
      updateData.image_url = image_url;
    }

    if (image_prompt !== undefined) {
      updateData.image_prompt = image_prompt;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ 
        error: 'No valid fields to update' 
      }, { status: 400 });
    }

    // Update content asset
    const { data: updatedAsset, error: updateError } = await supabase
      .from('content_assets')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        content_id,
        content_type,
        image_url,
        temporary_image_url,
        image_prompt,
        headline,
        content,
        created_at
      `)
      .single();

    if (updateError) {
      console.error('Error updating content asset:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update content asset', 
        details: updateError.message 
      }, { status: 500 });
    }

    if (!updatedAsset) {
      return NextResponse.json({ 
        error: 'Content asset not found' 
      }, { status: 404 });
    }

    console.log(`Successfully updated content asset ${id}`);
    return NextResponse.json(updatedAsset);

  } catch (error) {
    console.error('Content asset update error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 