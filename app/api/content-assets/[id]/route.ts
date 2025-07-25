import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { authenticateApiRequest, validateContentAssetAccess } from '@/lib/api-auth-helpers';
import { createClient as createServerClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request);
    if (authError) return authError;
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ 
        error: 'Content asset ID is required' 
      }, { status: 400 });
    }
    
    // Validate user has access to this content asset
    const { hasAccess } = await validateContentAssetAccess(user!.id, id, request);
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied' 
      }, { status: 403 });
    }

    // Get content asset using server client
    const supabase = await createServerClient();
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate the request
    const { user, error: authError } = await authenticateApiRequest(request);
    if (authError) return authError;
    
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json({ 
        error: 'Content asset ID is required' 
      }, { status: 400 });
    }
    
    // Validate user has access to this content asset
    const { hasAccess } = await validateContentAssetAccess(user!.id, id, request);
    if (!hasAccess) {
      return NextResponse.json({ 
        error: 'Access denied' 
      }, { status: 403 });
    }

    // Initialize service role client only after authorization for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Extract allowed fields for update
    const { image_url, image_prompt, use_temporary_image, cancel_temporary_image } = body;
    const updateData: Record<string, unknown> = {};

    // Handle using temporary image (download from temporary URL and store to Supabase)
    if (use_temporary_image) {
      // First, get the current asset data
      const { data: currentAsset, error: fetchError } = await supabase
        .from('content_assets')
        .select('id, content_type, temporary_image_url')
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

      // Download the image from the temporary URL
      console.log(`Downloading image from temporary URL: ${currentAsset.temporary_image_url}`);
      
      try {
        const imageResponse = await fetch(currentAsset.temporary_image_url);
        
        if (!imageResponse.ok) {
          throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        
        // Determine file extension from URL or content type
        let fileExtension = 'jpg'; // default
        try {
          const url = new URL(currentAsset.temporary_image_url);
          const pathExtension = url.pathname.split('.').pop()?.toLowerCase();
          if (pathExtension && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(pathExtension)) {
            fileExtension = pathExtension;
          }
        } catch {
          // If URL parsing fails, try content type
          const contentType = imageResponse.headers.get('content-type');
          if (contentType?.includes('png')) fileExtension = 'png';
          else if (contentType?.includes('webp')) fileExtension = 'webp';
          else if (contentType?.includes('gif')) fileExtension = 'gif';
        }

        // Generate filename: {content_asset_id}_{content_type}.{extension}
        const filename = `${currentAsset.id}_${currentAsset.content_type}.${fileExtension}`;
        
        console.log(`Storing image to Supabase storage: ${filename}`);

        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('images')
          .upload(filename, imageBuffer, {
            contentType: imageResponse.headers.get('content-type') || `image/${fileExtension}`,
            upsert: true // Overwrite existing file with same name
          });

        if (uploadError) {
          console.error('Error uploading image to Supabase storage:', uploadError);
          return NextResponse.json({ 
            error: 'Failed to store image to storage', 
            details: uploadError.message 
          }, { status: 500 });
        }

        // Get the public URL for the stored image
        const { data: { publicUrl: localPublicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(filename);

        // In local development, convert local Supabase URLs to external Supabase URLs for external services access
        let publicUrl = localPublicUrl;
        if (process.env.NODE_ENV === 'development' && 
            (localPublicUrl.includes('127.0.0.1:54321') || localPublicUrl.includes('127.0.0.1:54323')) && 
            process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
          // Extract the path from the local Supabase URL and construct external Supabase URL
          const urlPath = localPublicUrl.replace(/http:\/\/127\.0\.0\.1:543(21|23)/, '');
          publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
          console.log(`Converted local URL to external URL: ${localPublicUrl} -> ${publicUrl}`);
        }

        // Add timestamp cache buster to the image URL for Vercel compatibility
        const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;
        
        // Update database with permanent image URL (with cache buster) and clear temporary
        updateData.image_url = cacheBustedUrl;
        updateData.temporary_image_url = null;
        
        console.log(`Successfully stored image and updated database for content asset ${id}`);
        console.log(`Permanent URL: ${publicUrl}`);
        
      } catch (imageError) {
        console.error('Error downloading/storing image:', imageError);
        return NextResponse.json({ 
          error: 'Failed to download and store image', 
          details: imageError instanceof Error ? imageError.message : 'Unknown error' 
        }, { status: 500 });
      }
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
    
    // Invalidate Next.js caches to ensure fresh images are displayed
    // This is the official solution for the Router Cache image refresh issue
    if (updatedAsset.content_id) {
      revalidatePath(`/content/${updatedAsset.content_id}`);
      console.log(`✅ Cache invalidated for content/${updatedAsset.content_id}`);
    }
    
    return NextResponse.json(updatedAsset);

  } catch (error) {
    console.error('Content asset update error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 