import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create a Supabase client with service role key (bypasses RLS)
// Singleton pattern to avoid recreating client on every request
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    // Get the form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const businessId = formData.get('businessId') as string;
    const contentId = formData.get('contentId') as string;

    if (!file || !businessId || !contentId) {
      return NextResponse.json(
        { error: 'Missing required fields: file, businessId, or contentId' },
        { status: 400 }
      );
    }

    // Generate the filename
    const filename = `${businessId}_${contentId}.webm`;

    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();

    // Upload to Supabase storage using service role (bypasses RLS)
    const { data, error } = await getSupabaseAdmin().storage
      .from('audio')
      .upload(filename, fileBuffer, {
        contentType: 'audio/webm',
        upsert: true
      });

    if (error) {
      console.error('Upload error:', error);
      return NextResponse.json(
        { 
          error: 'Failed to upload file',
          ...(process.env.NODE_ENV === 'development' && { details: error.message })
        },
        { status: 500 }
      );
    }

    // Return the public URL
    const { data: { publicUrl: localPublicUrl } } = getSupabaseAdmin().storage
      .from('audio')
      .getPublicUrl(filename);

    // In local development, convert local Supabase URLs to external Supabase URLs for external services access
    let publicUrl = localPublicUrl;
    if (process.env.NODE_ENV === 'development' && localPublicUrl.includes('127.0.0.1:54321') && process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL) {
      // Extract the path from the local Supabase URL and construct external Supabase URL
      const urlPath = localPublicUrl.replace('http://127.0.0.1:54321', '');
      publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_EXTERNAL_URL}${urlPath}`;
    }

    return NextResponse.json({
      success: true,
      path: data.path,
      publicUrl
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 