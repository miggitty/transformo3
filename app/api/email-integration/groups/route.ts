import { createClient } from '@/utils/supabase/server';
import { validateEmailProviderAndFetchGroups } from '@/lib/email-providers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the user's business
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.business_id) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get email integration using new table
    const { data: emailIntegration, error: integrationError } = await supabase
      .from('email_integrations')
      .select('provider, secret_id')
      .eq('business_id', profile.business_id)
      .eq('status', 'active')
      .single();

    if (integrationError || !emailIntegration) {
      return NextResponse.json(
        { success: false, error: 'Email integration not found. Please set up your email integration first.' },
        { status: 400 }
      );
    }

    if (!emailIntegration.provider || !emailIntegration.secret_id) {
      return NextResponse.json(
        { success: false, error: 'Email provider not configured. Please set up your email integration first.' },
        { status: 400 }
      );
    }

    // Get the API key from vault using updated RPC function
    const { data: apiKey, error: secretError } = await supabase.rpc('get_email_secret_v2', {
      p_business_id: profile.business_id
    });

    if (secretError || !apiKey) {
      console.error('Error retrieving email API key:', secretError);
      return NextResponse.json(
        { success: false, error: 'Unable to retrieve API key. Please reconfigure your email integration.' },
        { status: 500 }
      );
    }

    // Validate API key and fetch groups from the provider
    const result = await validateEmailProviderAndFetchGroups(
      emailIntegration.provider as 'mailerlite' | 'mailchimp' | 'brevo',
      apiKey
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Check if no groups were found
    if (!result.groups || result.groups.length === 0) {
      return NextResponse.json({
        success: true,
        groups: [],
        message: `No email groups found in your ${emailIntegration.provider} account. Please create a group first.`
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Email integration groups API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  // Handle refresh groups functionality
  return GET();
} 