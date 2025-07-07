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

    // 3. Get blog integration using the new table structure
    const { data: blogIntegration, error: integrationError } = await supabase
      .from('blog_integrations')
      .select(`
        provider,
        username,
        site_url,
        status
      `)
      .eq('business_id', business_id)
      .eq('status', 'active')
      .single();

    if (integrationError || !blogIntegration) {
      console.error('Error fetching blog integration:', integrationError);
      return NextResponse.json(
        { error: 'Blog integration not found or not active' },
        { status: 404 }
      );
    }

    // 4. Retrieve app password using the new database function
    const { data: appPassword, error: secretError } = await supabase
      .rpc('get_blog_secret_v2', { p_business_id: business_id });

    if (secretError) {
      console.error('Error retrieving blog secret:', secretError);
      return NextResponse.json(
        { error: 'Unable to retrieve blog credentials' },
        { status: 500 }
      );
    }

    if (!appPassword) {
      return NextResponse.json(
        { error: 'Blog credentials not found' },
        { status: 404 }
      );
    }

    // 5. Return blog configuration for N8N
    return NextResponse.json({
      success: true,
      blog_config: {
        provider: blogIntegration.provider,
        site_url: blogIntegration.site_url,
        username: blogIntegration.username,
        app_password: appPassword, // Decrypted app password from vault
      },
      business_id: business_id,
    });

  } catch (error) {
    console.error('Blog credentials API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 