import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { syncSocialMediaAccounts } from '@/app/actions/upload-post';

/**
 * POST /api/upload-post/profiles/sync
 * Sync social media accounts and fetch Facebook Page ID
 */
export async function POST() {
  try {
    // Verify user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Call the server action
    const result = await syncSocialMediaAccounts();
    
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // At this point we know result.data exists
    return NextResponse.json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 