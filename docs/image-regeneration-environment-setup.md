# Image Regeneration Environment Setup

## Required Environment Variables

Add these to your `.env.local` file:

```env
# N8N Image Regeneration Webhook
N8N_WEBHOOK_IMAGE_REGENERATION=https://your-n8n-instance.com/webhook/image-regeneration

# Rate Limiting Control (set to 'false' for testing, 'true' for production)
ENABLE_IMAGE_REGENERATION_RATE_LIMIT=false

# Existing N8N Variables (should already be set)
N8N_CALLBACK_SECRET=your-secure-secret-key
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

## N8N Workflow Configuration

Your N8N image regeneration workflow should:

1. **Receive webhook payload** with:
   - `content_asset_id`: ID of the content asset to update
   - `content_type`: Type of content (blog_post, social_rant, etc.)
   - `image_prompt`: The prompt for image generation
   - `business_id`: Business ID for billing/limits
   - `callbackUrl`: Where to send completion notification
   - `callbackSecret`: Secret for callback authentication

2. **Generate new image** using your AI image service

3. **Send callback** to `callbackUrl` with:
   ```json
   {
     "content_asset_id": "uuid-from-input",
     "workflow_type": "image_regeneration",
     "success": true,
     "new_image_url": "https://your-storage.com/new-image.jpg",
     "environment": "production"
   }
   ```

## Rate Limiting

- **5 images per 10 minutes** per business (when enabled)
- Can be enabled/disabled via `ENABLE_IMAGE_REGENERATION_RATE_LIMIT` environment variable
- Set to `false` for testing, `true` for production
- Rate limit resets every 10 minutes

## Image Storage

The new image URL should:
- Be publicly accessible
- Preferably use the same naming convention: `{contentId}_{contentType}.{extension}`
- Be hosted on your image storage service (Supabase, AWS S3, etc.)

## Testing

Test the integration by:
1. Opening any content with an image
2. Hovering over the image to see the AI button
3. Clicking the button to open the modal
4. Editing the prompt and clicking "Regenerate Image"
5. Waiting for the N8N workflow to complete
6. Selecting the new image and clicking "Save" 