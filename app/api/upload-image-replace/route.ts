import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with service role key (bypasses RLS)
// Singleton pattern to avoid recreating client on every request
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables');
    }
    
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return supabaseAdmin;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const contentAssetId = formData.get('contentAssetId') as string;
    const contentType = formData.get('contentType') as string;

    if (!file || !contentAssetId || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Generate filename following content assets pattern
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${contentAssetId}_${contentType}.${fileExtension}`;

    // Step 2: Convert file to buffer
    const fileBuffer = await file.arrayBuffer();

    // Step 3: Upload to Supabase storage (using service role to bypass RLS)
    const { error: uploadError } = await getSupabaseAdmin().storage
      .from('images')
      .upload(filename, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true // Replace existing file
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          ...(process.env.NODE_ENV === 'development' && { details: uploadError.message })
        },
        { status: 500 }
      );
    }

    // Step 4: Get public URL
    const { data: { publicUrl: localPublicUrl } } = getSupabaseAdmin().storage
      .from('images')
      .getPublicUrl(filename);

    // In local development, convert local Supabase URLs to external Supabase URLs for external services access
    let publicUrl = localPublicUrl;
    if (process.env.NODE_ENV === 'development' && localPublicUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
      // Extract the path from the local Supabase URL and construct external Supabase URL
      const urlPath = localPublicUrl.replace('http://127.0.0.1:54321', '');
      publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
    }

    // Step 5: Add cache busting for immediate UI update
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    // Step 6: Update content_assets table
    const { data: updatedAsset, error: updateError } = await getSupabaseAdmin()
      .from('content_assets')
      .update({ 
        image_url: cacheBustedUrl,
      })
      .eq('id', contentAssetId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json(
        { 
          error: 'Failed to update database',
          ...(process.env.NODE_ENV === 'development' && { details: updateError.message })
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: cacheBustedUrl,
      contentAsset: updatedAsset,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 