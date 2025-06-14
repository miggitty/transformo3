import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // This proxy route is only needed in development for n8n access via ngrok
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not available in production', { status: 404 });
  }
  
  try {
    // Construct the local Supabase storage URL
    const filePath = params.path.join('/');
    const supabaseStorageUrl = `http://127.0.0.1:54321/storage/v1/object/public/audio/${filePath}`;
    
    // Fetch the file from local Supabase
    const response = await fetch(supabaseStorageUrl);
    
    if (!response.ok) {
      return new NextResponse('File not found', { status: 404 });
    }
    
    // Get the file data and content type
    const fileData = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'audio/webm';
    
    // Return the file with proper headers
    return new NextResponse(fileData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
    
  } catch (error) {
    console.error('Storage proxy error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 