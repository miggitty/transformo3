import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Initialize Supabase client with service role key for N8N
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey,
      { auth: { persistSession: false } }
    );
    // 1. Secure the endpoint with existing N8N secret
    const callbackSecret = process.env.N8N_CALLBACK_SECRET;
    const authHeader = req.headers.get('authorization');
    
    if (!callbackSecret || authHeader !== `Bearer ${callbackSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      );
    }

    // 2. Parse the request body
    const { business_id } = await req.json();

    if (!business_id) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    // 3. Get business email configuration using new email_integrations table
    const { data: emailIntegration, error: integrationError } = await supabase
      .from('email_integrations')
      .select(`
        provider,
        sender_name,
        sender_email,
        selected_group_id,
        selected_group_name,
        status
      `)
      .eq('business_id', business_id)
      .eq('status', 'active')
      .single();

    if (integrationError || !emailIntegration) {
      console.error('Error fetching email integration:', integrationError);
      return NextResponse.json(
        { error: 'Email integration not found or not active' },
        { status: 404 }
      );
    }

    // 4. Retrieve API key using updated RPC function
    const { data: apiKey, error: secretError } = await supabase.rpc('get_email_secret_v2', {
      p_business_id: business_id
    });

    if (secretError || !apiKey) {
      console.error('Error retrieving email API key:', secretError);
      return NextResponse.json(
        { error: 'Unable to retrieve email API key' },
        { status: 500 }
      );
    }

    // 5. Return email configuration for N8N
    return NextResponse.json({
      success: true,
      email_config: {
        provider: emailIntegration.provider,
        api_key: apiKey, // Decrypted API key from vault
        sender_name: emailIntegration.sender_name,
        sender_email: emailIntegration.sender_email,
        selected_group_id: emailIntegration.selected_group_id,
        selected_group_name: emailIntegration.selected_group_name,
      },
      business_id: business_id,
    });

  } catch (error) {
    console.error('Email credentials API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 