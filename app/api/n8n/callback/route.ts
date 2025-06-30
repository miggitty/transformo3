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
      content_asset_id, // For image regeneration
      transcript, 
      content_title, 
      video_script, 
      success, 
      error, 
      environment,
      workflow_type, // New field to distinguish workflow types
      new_image_url, // For image regeneration results
      image_url // Alternative field name for image regeneration
    } = body;

    // Use either content_id or contentId for backward compatibility
    const finalContentId = content_id || contentId;

    // Detect image regeneration callback by presence of image_url field without transcript/content_title
    const isImageRegenerationCallback = (image_url || new_image_url) && !transcript && !content_title;

    // Log the callback for debugging (following documented pattern)
    console.log(`N8N callback received from ${environment || 'unknown'}:`, {
      content_id: finalContentId,
      workflow_type: workflow_type || (isImageRegenerationCallback ? 'image_regeneration' : 'unknown'),
      success,
      error: error || 'none',
      hasTranscript: !!transcript,
      hasTitle: !!content_title,
      hasVideoScript: !!video_script,
      hasImageUrl: !!(image_url || new_image_url)
    });

    // For image regeneration, content_id is optional if we have content_asset_id
    if (!finalContentId && !content_asset_id) {
      console.error('Missing content_id/contentId and content_asset_id in callback');
      return NextResponse.json({ error: 'Missing content_id or content_asset_id' }, { status: 400 });
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
      
    } else if (workflow_type === 'image_regeneration' || isImageRegenerationCallback) {
      // Image regeneration workflow completed
      console.log('Processing image regeneration workflow completion callback');
      
      const imageUrl = new_image_url || image_url;
      
      if (!imageUrl) {
        console.error('Missing image_url in image regeneration callback');
        return NextResponse.json({ error: 'Missing image_url' }, { status: 400 });
      }

      // Use provided content_asset_id or find it using content_id
      let targetContentAssetId = content_asset_id;
      
      if (!targetContentAssetId && finalContentId) {
        // Find the content asset that was being regenerated for this content
        // Look for content assets with images, prioritizing those being used in forms/displays
        const { data: contentAssets, error: findError } = await supabase
          .from('content_assets')
          .select('id, content_type, image_url, image_prompt')
          .eq('content_id', finalContentId)
          .not('image_url', 'is', null)
          .order('created_at', { ascending: false });
          
        if (findError || !contentAssets || contentAssets.length === 0) {
          console.error('Could not find content asset for image regeneration:', findError);
          return NextResponse.json({ error: 'Could not find content asset to update' }, { status: 404 });
        }
        
        // Prefer content assets with existing image_prompt (recently used for regeneration)
        // or fall back to the most recent one with an image
        let selectedAsset = contentAssets.find(asset => asset.image_prompt) || contentAssets[0];
        
        targetContentAssetId = selectedAsset.id;
        console.log('Found content asset for image regeneration:', {
          id: targetContentAssetId,
          content_type: selectedAsset.content_type,
          has_prompt: !!selectedAsset.image_prompt,
          total_assets: contentAssets.length
        });
      }

      if (!targetContentAssetId) {
        console.error('Could not determine content_asset_id for image regeneration callback');
        return NextResponse.json({ error: 'Could not determine content_asset_id for image regeneration' }, { status: 400 });
      }
      
      if (content_asset_id) {
        console.log('Using provided content_asset_id:', content_asset_id);
      }

      if (success !== false && imageUrl) {
        // Success case - store new image URL in temporary_image_url field
        // User must explicitly save to move it to the main image_url field
        
        const { data: assetData, error: assetUpdateError } = await supabase
          .from('content_assets')
          .update({ temporary_image_url: imageUrl })
          .eq('id', targetContentAssetId)
          .select('id, temporary_image_url')
          .single();

        if (assetUpdateError) {
          console.error('Error storing temporary image:', assetUpdateError);
          return NextResponse.json({ 
            error: 'Failed to store temporary image', 
            details: assetUpdateError.message 
          }, { status: 500 });
        }

        if (!assetData) {
          console.error('No content asset found with ID:', targetContentAssetId);
          return NextResponse.json({ error: 'Content asset not found' }, { status: 404 });
        }
        
        console.log(`Image regeneration completed successfully - stored temporary image for ${targetContentAssetId}:`, imageUrl);
        console.log('Temporary image stored in database, waiting for user approval');
        
        return NextResponse.json({ 
          success: true, 
          content_asset_id: targetContentAssetId,
          temporary_image_url: imageUrl,
          message: 'Image regeneration completed - pending user approval'
        });
      } else {
        // Error case - don't store anything
        console.log('Image regeneration failed:', error);
        return NextResponse.json({ 
          success: false, 
          error: error || 'Image regeneration failed',
          content_asset_id: targetContentAssetId 
        });
      }
      
    } else {
      // Audio processing workflow OR Video transcription workflow
      console.log('Processing audio/video transcription workflow completion callback');
      
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

      // If audio/video transcription was successful, automatically trigger content creation workflow
      if (isSuccess && transcript && content_title) {
        console.log('Audio/video transcription successful - triggering content creation workflow...');
        
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