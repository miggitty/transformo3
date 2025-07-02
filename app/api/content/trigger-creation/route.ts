import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content_id, secret } = body;

    // Verify the secret
    if (secret !== process.env.N8N_CALLBACK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!content_id) {
      return NextResponse.json({ error: 'Missing content_id' }, { status: 400 });
    }

    // Get content and business data for content creation
    const supabase = await createClient();
    
    const { data: content, error } = await supabase
      .from('content')
      .select(`
        *,
        businesses (*)
      `)
      .eq('id', content_id)
      .single();

    if (error || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    const business = content.businesses;
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Trigger N8N content creation workflow
    const webhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;
    
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Content creation webhook not configured' }, { status: 500 });
    }

    // Prepare payload for content creation workflow
    const contentCreationPayload = {
      contentId: content.id,
      content_title: content.content_title,
      transcript: content.transcript,
      research: content.research,
      video_script: content.video_script,
      keyword: content.keyword,
      business_name: business.name,
      website_url: business.website_url,
      social_media_profiles: business.social_media_profiles,
      social_media_integrations: business.social_media_integrations,
      writing_style_guide: business.writing_style_guide,
      cta_youtube: business.cta_youtube,
      cta_email: business.cta_email,
      first_name: business.first_name,
      last_name: business.last_name,
      cta_social_long: business.cta_social_long,
      cta_social_short: business.cta_social_short,
      booking_link: business.booking_link,
      email_name_token: business.email_name_token,
      email_sign_off: business.email_sign_off,
      color_primary: business.color_primary,
      color_secondary: business.color_secondary,
      color_background: business.color_background,
      color_highlight: business.color_highlight,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contentCreationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Failed to trigger content creation: ${errorText}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Content creation workflow triggered for ${content_id}` 
    });

  } catch (error) {
    console.error('Error in trigger-creation API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 