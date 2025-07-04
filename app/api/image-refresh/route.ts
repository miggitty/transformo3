import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Force fetch the image with cache-busting headers
    const response = await fetch(imageUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to refresh image' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Image refreshed successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Image refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 