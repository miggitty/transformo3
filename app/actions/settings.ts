'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const heygenSettingsFormSchema = z.object({
  heygen_api_key: z.string().optional(),
  heygen_avatar_id: z.string().min(1, 'Avatar ID is required.'),
  heygen_voice_id: z.string().min(1, 'Voice ID is required.'),
});

const emailSettingsFormSchema = z.object({
  email_api_key: z.string().optional(),
  email_provider: z.enum(['mailerlite', 'mailchimp', 'brevo']).optional(),
  email_sender_name: z.string().min(1, 'Sender name is required.').optional(),
  email_sender_email: z.string().email('Please enter a valid email address.').optional(),
  email_selected_group_id: z.string().optional(),
  email_selected_group_name: z.string().optional(),
});

const blogSettingsFormSchema = z.object({
  blog_provider: z.enum(['wordpress', 'wix']).optional(),
  blog_username: z.string().min(1, 'Username is required').optional(),
  blog_credential: z.string().optional(),
  blog_site_url: z.string().url('Please enter a valid URL').optional(),
}).refine((data) => {
  // If no provider is selected, all fields are optional
  if (!data.blog_provider) return true;
  
  // Allow updates without credential (for when credentials are already set)
  // Only require credential when it's explicitly provided
  if (data.blog_credential) {
    // If credential is provided, validate based on provider requirements
    if (data.blog_provider === 'wordpress') {
      return data.blog_username && data.blog_site_url;
    }
    // Wix only requires the credential itself
    return true;
  }
  
  // If no credential provided, allow other field updates
  return true;
}, {
  message: "Please provide all required fields for the selected blog provider.",
  path: ["blog_credential"]
});

// Action to update settings
export async function updateHeygenSettings(
  businessId: string,
  formData: z.infer<typeof heygenSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = heygenSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { heygen_api_key, heygen_avatar_id, heygen_voice_id } = parsedData.data;

  try {
    // If API key is provided, create/update the integration
    if (heygen_api_key) {
      const { error: rpcError } = await supabase.rpc('set_ai_avatar_integration', {
        p_business_id: businessId,
        p_provider: 'heygen',
        p_api_key: heygen_api_key,
        p_avatar_id: heygen_avatar_id,
        p_voice_id: heygen_voice_id,
      });

      if (rpcError) {
        console.error('Error saving AI avatar integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    } else {
      // Update only configuration fields if no API key provided
      const { error: updateError } = await supabase
        .from('ai_avatar_integrations')
        .update({
          avatar_id: heygen_avatar_id,
          voice_id: heygen_voice_id,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('provider', 'heygen')
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating AI avatar integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateHeygenSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Action to remove the API key
export async function removeHeygenApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_ai_avatar_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting AI avatar integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}

// Action to generate HeyGen video (triggers n8n workflow)
export async function generateHeygenVideo(
  businessId: string,
  contentId: string,
  script: string
) {
  const supabase = await createClient();

  try {
    // Check if AI avatar integration exists
    const { data: aiAvatarIntegration } = await supabase
      .from('ai_avatar_integrations')
      .select('id, avatar_id, voice_id')
      .eq('business_id', businessId)
      .eq('provider', 'heygen')
      .eq('status', 'active')
      .single();

    if (!aiAvatarIntegration) {
      return { error: 'HeyGen AI avatar integration not configured. Please set up your HeyGen integration first.' };
    }

    // First, update the content status to 'processing'
    const { error: updateError } = await supabase
      .from('content')
      .update({
        heygen_status: 'processing'
      })
      .eq('id', contentId);

    if (updateError) {
      console.error('Error updating content status:', updateError);
      return { error: `Could not start video generation: ${updateError.message}` };
    }

    // Then, trigger the n8n webhook
    const webhookUrl = process.env.N8N_HEYGEN_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.error('N8N_HEYGEN_WEBHOOK_URL is not set.');
      return { error: 'Webhook URL is not configured.' };
    }
    
    const payload = {
      business_id: businessId,
      content_id: contentId,
      script: script
    };

    console.log('Calling n8n webhook:', webhookUrl, 'with payload:', payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`n8n webhook call failed with status ${response.status}:`, errorBody);
      
      // Revert the status update if webhook fails
      await supabase
        .from('content')
        .update({ heygen_status: null })
        .eq('id', contentId);
        
      return { error: `Failed to trigger video generation: ${response.statusText}` };
    }

    console.log('n8n webhook called successfully');
    revalidatePath(`/content/${contentId}`);
    return { success: true };

  } catch (error) {
    console.error('Error in generateHeygenVideo:', error);
    
    // Revert the status update if there's an error
    await supabase
      .from('content')
      .update({ heygen_status: null })
      .eq('id', contentId);
      
    return { error: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

// Email Integration Server Actions

// Action to update email settings
export async function updateEmailSettings(
  businessId: string,
  formData: z.infer<typeof emailSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = emailSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { email_api_key, email_provider, email_sender_name, email_sender_email, email_selected_group_id, email_selected_group_name } = parsedData.data;

  try {
    // If API key is provided, create/update the integration
    if (email_api_key && email_provider) {
      const { error: rpcError } = await supabase.rpc('set_email_integration', {
        p_business_id: businessId,
        p_provider: email_provider,
        p_api_key: email_api_key,
        p_sender_name: email_sender_name,
        p_sender_email: email_sender_email,
      });

      if (rpcError) {
        console.error('Error saving email integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    }

    // Update additional fields if no API key provided but integration exists
    if (!email_api_key && (email_sender_name || email_sender_email || email_selected_group_id)) {
      const { error: updateError } = await supabase
        .from('email_integrations')
        .update({
          sender_name: email_sender_name,
          sender_email: email_sender_email,
          selected_group_id: email_selected_group_id,
          selected_group_name: email_selected_group_name,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating email integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateEmailSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Action to remove the email API key
export async function removeEmailApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_email_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting email integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}

// Blog Integration Server Actions

// Action to update blog settings
export async function updateBlogSettings(
  businessId: string,
  formData: z.infer<typeof blogSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = blogSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { 
    blog_provider,
    blog_username, 
    blog_credential, 
    blog_site_url 
  } = parsedData.data;

  // Clean up site URL by removing trailing slash
  const cleanSiteUrl = blog_site_url?.replace(/\/$/, '');

  try {
    // If credential is provided, create/update the integration
    if (blog_credential && blog_provider) {
      const { error: rpcError } = await supabase.rpc('set_blog_integration', {
        p_business_id: businessId,
        p_provider: blog_provider,
        p_credential: blog_credential,
        p_username: blog_username,
        p_site_url: cleanSiteUrl,
      });

      if (rpcError) {
        console.error('Error saving blog integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    }

    // Update additional fields if no credential provided but integration exists
    if (!blog_credential && (blog_username || cleanSiteUrl)) {
      const { error: updateError } = await supabase
        .from('blog_integrations')
        .update({
          username: blog_username,
          site_url: cleanSiteUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating blog integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateBlogSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

// Action to remove blog credentials
export async function removeBlogCredentials(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_blog_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting blog integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}

// Action to validate blog connection
export async function validateBlogConnection(
  provider: 'wordpress' | 'wix',
  credential: string,
  siteUrl?: string,
  username?: string
) {
  try {
    const response = await fetch('/api/blog-integration/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        credential,
        siteUrl,
        username,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.error || 'Validation failed' };
    }

    return { success: true, siteInfo: result.siteInfo };
  } catch (error) {
    console.error('Error validating blog connection:', error);
    return { error: 'Failed to validate connection. Please try again.' };
  }
} 