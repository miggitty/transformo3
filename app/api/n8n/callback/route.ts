import { createClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with service role key inside the function
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables for Supabase');
      return NextResponse.json({ 
        error: 'Server configuration error' 
      }, { status: 500 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const body = await request.json();
    console.log('N8N callback received:', {
      headers: Object.fromEntries(request.headers.entries()),
      body: JSON.stringify(body, null, 2)
    });

    // Verify N8N callback secret (following documented pattern)
    const callbackSecret = request.headers.get('x-n8n-callback-secret');
    if (callbackSecret && process.env.N8N_CALLBACK_SECRET && callbackSecret !== process.env.N8N_CALLBACK_SECRET) {
      console.log('N8N callback secret mismatch:', { received: callbackSecret, expected: process.env.N8N_CALLBACK_SECRET });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      content_id, 
      contentId, // Handle both formats for backward compatibility
      transcript, 
      content_title, 
      video_script, 
      success, 
      error, 
      environment,
      workflow_type // New field to distinguish workflow types
    } = body;

    // Use either content_id or contentId for backward compatibility
    const finalContentId = content_id || contentId;

    // Log the callback for debugging (following documented pattern)
    console.log(`N8N callback received from ${environment || 'unknown'}:`, {
      content_id: finalContentId,
      workflow_type: workflow_type || 'unknown',
      success,
      error: error || 'none',
      hasTranscript: !!transcript,
      hasTitle: !!content_title,
      hasVideoScript: !!video_script
    });

    if (!finalContentId) {
      console.error('Missing content_id/contentId in callback');
      return NextResponse.json({ error: 'Missing content_id' }, { status: 400 });
    }

    // Handle different workflow types
    if (workflow_type === 'content_creation') {
      // Content creation workflow completed
      console.log('Processing content creation workflow completion callback');
      
      const updateData: Record<string, unknown> = {};
      
      if (success !== false) {
        // Success case - mark content generation as completed
        updateData.content_generation_status = 'completed';
        updateData.error_message = null;
        console.log('Content creation completed successfully');
      } else {
        // Error case - mark as failed
        updateData.content_generation_status = 'failed';
        updateData.error_message = error || 'Content creation workflow failed';
        console.log('Content creation failed:', error);
      }

      // Update content generation status
      const { data, error: updateError } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', finalContentId)
        .select('id, content_generation_status')
        .single();

      if (updateError) {
        console.error('Error updating content generation status:', updateError);
        return NextResponse.json({ 
          error: 'Database update failed', 
          details: updateError.message 
        }, { status: 500 });
      }

      if (!data) {
        console.error('No content found with ID:', finalContentId);
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      console.log(`Successfully updated content generation status for ${finalContentId} to: ${updateData.content_generation_status}`);
      return NextResponse.json({ success: true, updated: data });
      
    } else {
      // Audio processing workflow (existing logic)
      console.log('Processing audio processing workflow completion callback');
      
      // Handle both success and error cases
      // If success field is not provided but we have transcript and title, assume success
      const isSuccess = success !== false && transcript && content_title;
      
      const updateData: Record<string, unknown> = {};

      if (isSuccess) {
        // Success case - update with processed data
        updateData.status = 'completed';
        updateData.transcript = transcript;
        updateData.content_title = content_title;
        if (video_script) {
          updateData.video_script = video_script;
        }
        // Clear any previous error
        updateData.error_message = null;
      } else {
        // Error case - only update status and error message
        updateData.status = 'processing'; // Keep as processing rather than unknown 'error' status
        updateData.error_message = error || 'N8N workflow failed without specific error';
      }

      console.log('Updating content with data:', { content_id: finalContentId, updateData });

      // Update content based on N8N callback
      const { data, error: updateError } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', finalContentId)
        .select('*, businesses!inner(*)')
        .single();

      if (updateError) {
        console.error('Error updating content:', updateError);
        return NextResponse.json({ 
          error: 'Database update failed', 
          details: updateError.message 
        }, { status: 500 });
      }

      if (!data) {
        console.error('No content found with ID:', finalContentId);
        return NextResponse.json({ error: 'Content not found' }, { status: 404 });
      }

      console.log(`Successfully updated content ${finalContentId} - Status: ${updateData.status}`);

      // If audio processing was successful, automatically trigger content creation workflow
      if (isSuccess && transcript && content_title) {
        console.log('Audio processing successful - triggering content creation workflow...');
        
        const contentCreationWebhookUrl = process.env.N8N_WEBHOOK_URL_CONTENT_CREATION;
        
        if (contentCreationWebhookUrl) {
          try {
            // Prepare payload for content creation workflow (following existing pattern)
            const contentCreationPayload = {
              // Content fields
              contentId: data.id,
              content_title: data.content_title,
              transcript: data.transcript,
              research: data.research,
              video_script: data.video_script,
              keyword: data.keyword,
              // Business fields  
              business_name: data.businesses.business_name,
              website_url: data.businesses.website_url,
              social_media_profiles: data.businesses.social_media_profiles,
              social_media_integrations: data.businesses.social_media_integrations,
              writing_style_guide: data.businesses.writing_style_guide,
              cta_youtube: data.businesses.cta_youtube,
              cta_email: data.businesses.cta_email,
              first_name: data.businesses.first_name,
              last_name: data.businesses.last_name,
              cta_social_long: data.businesses.cta_social_long,
              cta_social_short: data.businesses.cta_social_short,
              booking_link: data.businesses.booking_link,
              email_name_token: data.businesses.email_name_token,
              email_sign_off: data.businesses.email_sign_off,
              // Color fields
              color_primary: data.businesses.color_primary,
              color_secondary: data.businesses.color_secondary,
              color_background: data.businesses.color_background,
              color_highlight: data.businesses.color_highlight,
              // Environment info for callback
              callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/n8n/callback`,
              callbackSecret: process.env.N8N_CALLBACK_SECRET,
              environment: process.env.NODE_ENV
            };

            // Set content generation status to 'generating'
            await supabase
              .from('content')
              .update({ content_generation_status: 'generating' })
              .eq('id', data.id);

            console.log('Triggering N8N content creation workflow with payload:', {
              contentId: contentCreationPayload.contentId,
              hasTranscript: !!contentCreationPayload.transcript,
              hasTitle: !!contentCreationPayload.content_title,
              businessName: contentCreationPayload.business_name
            });

            const contentCreationResponse = await fetch(contentCreationWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(contentCreationPayload),
            });

            if (contentCreationResponse.ok) {
              console.log('Successfully triggered content creation workflow');
            } else {
              const errorText = await contentCreationResponse.text();
              console.error('Failed to trigger content creation workflow:', {
                status: contentCreationResponse.status,
                error: errorText
              });
              
              // Revert the content generation status if workflow trigger fails
              await supabase
                .from('content')
                .update({ content_generation_status: null })
                .eq('id', data.id);
            }
          } catch (contentCreationError) {
            console.error('Error triggering content creation workflow:', contentCreationError);
            
            // Revert the content generation status if error occurs
            await supabase
              .from('content')
              .update({ content_generation_status: null })
              .eq('id', data.id);
          }
        } else {
          console.warn('N8N_WEBHOOK_URL_CONTENT_CREATION not configured - skipping automatic content creation');
        }
      }

      return NextResponse.json({ success: true, updated: data });
    }
    
  } catch (error) {
    console.error('N8N callback error:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 