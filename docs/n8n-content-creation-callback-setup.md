# N8N Content Creation Workflow Callback Setup

This document explains how to configure your N8N content creation workflow to send a callback when content generation is complete, enabling better user experience with field disabling and automatic updates.

## Overview

When content generation is triggered, the app now:
1. **Sets status to 'generating'** - Disables all form fields and shows status indicator
2. **Waits for N8N callback** - Content creation workflow runs in background
3. **Re-enables fields when complete** - Callback updates status and refreshes content

## Required N8N Workflow Configuration

### 1. Add HTTP Request Node at the End of Your Workflow

Add an **HTTP Request** node as the final step in your content creation workflow with these settings:

**Node Settings:**
- **Name**: `Send Completion Callback`
- **Method**: `POST`
- **URL**: Use the `callbackUrl` from the input payload (e.g., `https://your-domain.com/api/n8n/callback`)

**Headers:**
```json
{
  "Content-Type": "application/json",
  "x-n8n-callback-secret": "{{ $json.callbackSecret }}"
}
```

**Body (JSON):**
```json
{
  "content_id": "{{ $json.contentId }}",
  "workflow_type": "content_creation",
  "success": true,
  "environment": "{{ $json.environment }}",
  "timestamp": "{{ new Date().toISOString() }}"
}
```

### 2. Add Error Handling Node

Add an **HTTP Request** node in your error handling flow:

**Node Settings:**
- **Name**: `Send Error Callback`
- **Method**: `POST` 
- **URL**: Use the `callbackUrl` from the input payload

**Body (JSON):**
```json
{
  "content_id": "{{ $json.contentId }}",
  "workflow_type": "content_creation", 
  "success": false,
  "error": "{{ $json.error || 'Content creation workflow failed' }}",
  "environment": "{{ $json.environment }}",
  "timestamp": "{{ new Date().toISOString() }}"
}
```

## Workflow Structure Example

```
1. Webhook Trigger (receives content data)
2. [Your content generation nodes]
3. [Process blog posts, emails, social media, etc.]
4. [Final content asset creation]
5. Send Completion Callback ✅
   OR
   Send Error Callback ❌ (if any step fails)
```

## Environment Variables Required

Make sure these environment variables are configured in your app:

```env
# Your app's base URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Secret for N8N callback authentication
N8N_CALLBACK_SECRET=your-secure-secret-key

# N8N webhook URLs
N8N_WEBHOOK_URL_CONTENT_CREATION=https://your-n8n-instance.com/webhook/content-creation
```

## Testing the Callback

### 1. Test Success Callback
```bash
curl -X POST https://your-domain.com/api/n8n/callback \
  -H "Content-Type: application/json" \
  -H "x-n8n-callback-secret: your-secret" \
  -d '{
    "content_id": "test-content-id",
    "workflow_type": "content_creation",
    "success": true,
    "environment": "development"
  }'
```

### 2. Test Error Callback
```bash
curl -X POST https://your-domain.com/api/n8n/callback \
  -H "Content-Type: application/json" \
  -H "x-n8n-callback-secret: your-secret" \
  -d '{
    "content_id": "test-content-id", 
    "workflow_type": "content_creation",
    "success": false,
    "error": "Test error message",
    "environment": "development"
  }'
```

## User Experience Flow

### Before (Without Callback)
1. User clicks "Regenerate Content"
2. Loading overlay appears briefly
3. Overlay disappears, but content still generating
4. User sees old content, thinks nothing happened
5. User might edit content while generation is running

### After (With Callback)
1. User clicks "Regenerate Content"
2. Warning dialog appears with confirmation
3. All form fields disabled with visual indicators
4. Status shows "Generating..." with spinner
5. N8N workflow runs in background
6. Callback received when complete
7. Fields re-enabled, fresh content displayed
8. Success/error message shown to user

## Debugging

### Check Callback Logs
Monitor your app logs for callback messages:
```
N8N callback received from production: {
  content_id: "abc123",
  workflow_type: "content_creation",
  success: true
}
```

### Check Content Status
Query the database to verify status updates:
```sql
SELECT id, content_title, content_generation_status, updated_at 
FROM content 
WHERE id = 'your-content-id';
```

### Real-time Updates
The app uses Supabase real-time subscriptions to immediately detect status changes and update the UI without requiring page refresh.

## Error Handling

The callback system handles various error scenarios:

1. **Workflow Failure**: `success: false` with error message
2. **Network Issues**: Retry logic in N8N recommended
3. **Invalid Callback**: Authentication and validation checks
4. **Database Errors**: Status reverted to previous state

## Security Notes

- **Always use HTTPS** for production callbacks
- **Validate callback secret** on every request
- **Log all callbacks** for debugging and monitoring
- **Rate limit** callback endpoints if needed

## Troubleshooting

### Invalid URL Error

If you get an "Invalid URL" error like:
```
NodeApiError: Invalid URL at ExecuteContext.execute
Request: { "uri": "{{$env.LOCAL_URL}}/api/n8n/callback", ... }
```

This means the environment variable is not set in N8N. You have two solutions:

**Solution 1: Use Hardcoded URL (Recommended)**
- Change the URL in your HTTP Request node from: `{{$env.LOCAL_URL}}/api/n8n/callback`
- To your actual application URL: `https://your-app-domain.com/api/n8n/callback`

**Solution 2: Set Environment Variable in N8N**
1. Go to N8N Settings → Environment Variables
2. Add: `NEXT_PUBLIC_APP_URL` = `https://your-app-domain.com`
3. Use URL: `{{$env.NEXT_PUBLIC_APP_URL}}/api/n8n/callback` 