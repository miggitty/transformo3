# Automated Audio-to-Content Workflow

This document outlines the fully automated workflow that processes audio recordings and generates complete content assets without any manual intervention.

## Overview

When a user records audio through the application, the system now automatically:
1. **Processes the audio** (transcription, AI analysis)
2. **Generates all content assets** (blog posts, emails, social media content, etc.)
3. **Updates the content status** to completed with everything ready

The user simply needs to record their audio and wait - everything else is automated.

## Complete Workflow

### 1. Audio Recording & Upload
- User records audio using the in-app recorder
- Audio file is uploaded to Supabase Storage
- Content record is created with status `'processing'`

### 2. Audio Processing N8N Workflow
**Webhook URL**: `N8N_WEBHOOK_URL_AUDIO_PROCESSING`

**Triggered by**: `finalizeContentRecord()` server action

**Payload sent**:
```json
{
  "audio_url": "https://supabase-url/storage/v1/object/public/audio/file.webm",
  "content_id": "uuid",
  "business_id": "uuid",
  "callbackUrl": "https://app-url/api/n8n/callback",
  "callbackSecret": "secret",
  "environment": "development"
}
```

**This workflow**:
- Downloads the audio file
- Transcribes the audio using AI
- Analyzes content and generates a title
- Creates a video script if applicable
- Calls back to the application with results

### 3. N8N Callback & Automatic Chaining
**Route**: `/api/n8n/callback`

When the audio processing completes successfully, the callback:

1. **Updates the content record** with:
   - `transcript`: The transcribed text
   - `content_title`: AI-generated title
   - `video_script`: Generated script (if applicable)
   - `status`: Set to `'completed'`

2. **Automatically triggers the content creation workflow** by calling:
   - `N8N_WEBHOOK_URL_CONTENT_CREATION`
   - Passes all content and business data
   - No user interaction required

### 4. Content Creation N8N Workflow
**Webhook URL**: `N8N_WEBHOOK_URL_CONTENT_CREATION`

**Triggered automatically by**: Audio processing callback (when successful)

**Payload sent**:
```json
{
  "contentId": "uuid",
  "content_title": "AI Generated Title",
  "transcript": "Full transcribed text...",
  "research": null,
  "video_script": "Generated video script...",
  "keyword": null,
  "business_name": "Company Name",
  "website_url": "https://company.com",
  "writing_style_guide": "Brand voice guidelines...",
  "cta_youtube": "Subscribe for more!",
  "cta_email": "Join our newsletter",
  "first_name": "John",
  "last_name": "Doe",
  // ... all business configuration
  "callbackUrl": "https://app-url/api/n8n/callback",
  "callbackSecret": "secret",
  "environment": "development"
}
```

**This workflow generates**:
- Blog posts
- Email newsletters  
- Social media posts (long & short form)
- YouTube video descriptions
- Quote cards
- Social media rants
- All other content assets

### 5. Final Callback
The content creation workflow calls back to update all the generated `content_assets` in the database.

## User Experience

### Before (Manual Process)
1. User records audio ✅
2. User waits for audio processing ⏳
3. User manually clicks "Generate Content" 👆
4. User waits for content generation ⏳
5. Content is ready ✅

### After (Fully Automated)
1. User records audio ✅
2. **Everything happens automatically** 🤖
3. Content is ready ✅

## Environment Variables Required

```bash
# Audio Processing Workflow
N8N_WEBHOOK_URL_AUDIO_PROCESSING=https://n8n-instance/webhook/audio-processing

# Content Creation Workflow  
N8N_WEBHOOK_URL_CONTENT_CREATION=https://n8n-instance/webhook/content-creation

# Callback Security
N8N_CALLBACK_SECRET=your-secret-key

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-app-url
```

## Error Handling

- If audio processing fails, content creation is **not triggered**
- If content creation fails, the content record remains with just the transcript/title
- All errors are logged for debugging
- Users can manually trigger content creation later if needed

## Monitoring & Debugging

The workflow provides extensive logging:

```
✅ Audio processing successful - triggering content creation workflow...
✅ Successfully triggered content creation workflow
❌ Failed to trigger content creation workflow: [error details]
⚠️  N8N_WEBHOOK_URL_CONTENT_CREATION not configured - skipping automatic content creation
```

## Configuration Notes

- The automatic chaining only happens when `N8N_WEBHOOK_URL_CONTENT_CREATION` is configured
- If not configured, the system gracefully falls back to manual content generation
- The workflow is backward compatible - existing manual triggers still work
- Both workflows use the same callback endpoint for consistency

## Testing

To test the full automated workflow:

1. Ensure both webhook URLs are configured
2. Record an audio file through the app
3. Monitor logs for the automatic progression:
   - Audio upload → Audio processing → Callback → Content creation trigger
4. Check that content assets are generated automatically
5. Verify the content status shows as `'completed'`

This creates a seamless, zero-click experience from audio recording to complete content generation. 