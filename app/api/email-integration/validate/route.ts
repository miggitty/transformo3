import { validateEmailProviderAndFetchGroups } from '@/lib/email-providers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { provider, apiKey } = await request.json();
    
    if (!provider || !apiKey) {
      return NextResponse.json(
        { success: false, error: 'Provider and API key are required' },
        { status: 400 }
      );
    }

    // Validate the provider type
    if (!['mailerlite', 'mailchimp', 'brevo'].includes(provider)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email provider' },
        { status: 400 }
      );
    }

    // Test the API key by attempting to fetch groups
    const result = await validateEmailProviderAndFetchGroups(provider, apiKey);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key is valid',
      groupCount: result.groups?.length || 0
    });

  } catch (error) {
    console.error('Email provider validation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 