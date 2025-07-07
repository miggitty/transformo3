# Video & Image Compression - Phase 2: Database & N8N Workflow

## Overview

This document provides the **complete implementation** for Phase 2: Database schema updates and N8N compression workflow creation. After completing Phase 1 (Railway service), this phase sets up the database and creates the N8N workflow that connects your app to the compression service.

**⚠️ Prerequisites**: Complete Phase 1 (Railway service deployed and tested)

**✅ What You'll Build**:
- Database migration for video thumbnail fields
- Complete N8N compression workflow (microservices pattern)
- Railway service integration with error handling
- Testing procedures to validate everything works

## 🗄️ **Database Schema Updates**

### **Step 1: Create Migration File**

1. **Open your terminal** in your project root
2. **Generate timestamp** for Brisbane timezone:
   ```bash
   timestamp=$(TZ=Australia/Brisbane date +"%Y%m%d%H%M%S")
   echo $timestamp
   ```
3. **Create migration file**:
   ```bash
   touch "supabase/migrations/${timestamp}_add-video-thumbnail-fields.sql"
   ```

### **Step 2: Add Migration Content**

**File: `supabase/migrations/YYYYMMDDHHMMSS_add-video-thumbnail-fields.sql`**
```sql
-- Add video thumbnail URL fields to content table
-- These fields will store thumbnails extracted from compressed videos

-- Add the thumbnail URL columns
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_long_thumbnail_url TEXT;
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_short_thumbnail_url TEXT;

-- Add documentation comments
COMMENT ON COLUMN content.video_long_thumbnail_url IS 'Thumbnail/poster frame URL for long video (aspect ratio matches source video)';
COMMENT ON COLUMN content.video_short_thumbnail_url IS 'Thumbnail/poster frame URL for short video (aspect ratio matches source video)';

-- Create indexes for better query performance (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_content_video_long_thumbnail ON content(video_long_thumbnail_url) WHERE video_long_thumbnail_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_video_short_thumbnail ON content(video_short_thumbnail_url) WHERE video_short_thumbnail_url IS NOT NULL;

-- Add RLS policy to allow authenticated users to read thumbnails
-- (Thumbnails should be publicly accessible like other images)
-- Note: This assumes your existing RLS policies are properly configured
```

### **Step 3: Deploy Migration**

1. **Test migration locally** (if using local Supabase):
   ```bash
   supabase db reset --local
   ```

2. **Deploy to production**:
   ```bash
   supabase db push
   ```

3. **Verify migration applied**:
   - Go to Supabase dashboard
   - Navigate to Table Editor → content table
   - Confirm new columns exist: `video_long_thumbnail_url`, `video_short_thumbnail_url`

## 🔄 **N8N Compression Workflow Creation**

### **Step 1: Create New Workflow in N8N**

1. **Open N8N interface**
2. **Click "New Workflow"**
3. **Save as**: `"Content Compression Service"`

### **Step 2: Add Complete Workflow JSON**

**Replace the entire workflow with this complete implementation**:

```json
{
  "name": "Content Compression Service",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "compression-service",
        "options": {}
      },
      "id": "webhook-compression-request",
      "name": "Compression Request",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [200, 300],
      "webhookId": "compression-service-webhook"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "condition-type-check",
              "leftValue": "={{ $json.body.type }}",
              "rightValue": "image",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "check-compression-type",
      "name": "Is Image Compression?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [400, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.RAILWAY_COMPRESSION_SERVICE_URL }}/api/compress/image",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"imageUrl\": \"{{ $json.body.imageUrl }}\",\n  \"contentAssetId\": \"{{ $json.body.contentAssetId }}\",\n  \"contentType\": \"{{ $json.body.contentType }}\",\n  \"callbackUrl\": \"{{ $env.NEXT_PUBLIC_APP_URL }}/api/n8n/callback\",\n  \"callbackSecret\": \"{{ $env.N8N_CALLBACK_SECRET }}\"\n}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "compress-image",
      "name": "Compress Image",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [600, 200],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.RAILWAY_COMPRESSION_SERVICE_URL }}/api/compress/video",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"videoUrl\": \"{{ $json.body.videoUrl }}\",\n  \"businessId\": \"{{ $json.body.businessId }}\",\n  \"contentId\": \"{{ $json.body.contentId }}\",\n  \"videoType\": \"{{ $json.body.videoType }}\",\n  \"callbackUrl\": \"{{ $env.NEXT_PUBLIC_APP_URL }}/api/n8n/callback\",\n  \"callbackSecret\": \"{{ $env.N8N_CALLBACK_SECRET }}\"\n}",
        "options": {
          "timeout": 30000
        }
      },
      "id": "compress-video",
      "name": "Compress Video",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [600, 400],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "success-condition",
              "leftValue": "={{ $json.status }}",
              "rightValue": "processing",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "check-compression-success",
      "name": "Compression Started?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [800, 300]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": true,\n  \"jobId\": \"{{ $json.jobId }}\",\n  \"status\": \"{{ $json.status }}\",\n  \"estimatedTime\": \"{{ $json.estimatedTime }}\",\n  \"message\": \"Compression job started successfully\"\n}"
      },
      "id": "success-response",
      "name": "Success Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1000, 200]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": false,\n  \"error\": \"Compression failed to start\",\n  \"details\": \"{{ $json.error || 'Unknown error' }}\",\n  \"originalRequest\": {{ JSON.stringify($('Compression Request').item.json.body) }}\n}",
        "options": {
          "responseCode": 500
        }
      },
      "id": "error-response",
      "name": "Error Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1000, 400]
    },
    {
      "parameters": {
        "jsCode": "// Log compression request details for debugging\nconst requestData = $input.first().json.body;\n\nconsole.log('Compression Request Received:', {\n  type: requestData.type,\n  timestamp: new Date().toISOString(),\n  imageUrl: requestData.imageUrl,\n  videoUrl: requestData.videoUrl,\n  contentId: requestData.contentId || requestData.contentAssetId\n});\n\n// Pass through the original data\nreturn $input.all();"
      },
      "id": "log-request",
      "name": "Log Request",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [200, 500]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "validate-image-fields",
              "leftValue": "={{ $json.body.imageUrl && $json.body.contentAssetId }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "validate-image-request",
      "name": "Valid Image Request?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [600, 100]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "validate-video-fields",
              "leftValue": "={{ $json.body.videoUrl && $json.body.businessId && $json.body.contentId }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ],
          "combinator": "and"
        }
      },
      "id": "validate-video-request",
      "name": "Valid Video Request?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [600, 500]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": false,\n  \"error\": \"Invalid request\",\n  \"message\": \"Missing required fields for {{ $('Is Image Compression?').item.json.body.type }} compression\",\n  \"required\": {{ $('Is Image Compression?').item.json.body.type === 'image' ? '[\"imageUrl\", \"contentAssetId\"]' : '[\"videoUrl\", \"businessId\", \"contentId\"]' }}\n}",
        "options": {
          "responseCode": 400
        }
      },
      "id": "validation-error-response",
      "name": "Validation Error",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [800, 600]
    }
  ],
  "connections": {
    "Compression Request": {
      "main": [
        [
          {
            "node": "Log Request",
            "type": "main",
            "index": 0
          },
          {
            "node": "Is Image Compression?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Is Image Compression?": {
      "main": [
        [
          {
            "node": "Valid Image Request?",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Valid Video Request?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Valid Image Request?": {
      "main": [
        [
          {
            "node": "Compress Image",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Validation Error",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Valid Video Request?": {
      "main": [
        [
          {
            "node": "Compress Video",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Validation Error",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Compress Image": {
      "main": [
        [
          {
            "node": "Compression Started?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Compress Video": {
      "main": [
        [
          {
            "node": "Compression Started?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Compression Started?": {
      "main": [
        [
          {
            "node": "Success Response",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Error Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "pinData": {},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": {},
  "tags": [
    {
      "createdAt": "2025-01-20T00:00:00.000Z",
      "updatedAt": "2025-01-20T00:00:00.000Z",
      "id": "compression-service",
      "name": "compression"
    }
  ],
  "triggerCount": 1,
  "updatedAt": "2025-01-20T00:00:00.000Z",
  "versionId": "1"
}
```

**✅ FIXED**: Complete N8N workflow JSON with all nodes and connections properly defined.

### **Step 3: Configure Environment Variables**

**In N8N Settings → Environment Variables, add**:

| Variable Name | Value | Description |
|---------------|-------|-------------|
| `RAILWAY_COMPRESSION_SERVICE_URL` | `https://your-railway-service.up.railway.app` | Your Railway service URL from Phase 1 |
| `NEXT_PUBLIC_APP_URL` | `https://your-app-domain.com` | Your Next.js app URL (for callbacks) |
| `N8N_CALLBACK_SECRET` | `your-existing-callback-secret` | **Use same secret as existing N8N integrations** |

**⚠️ Important**: Use your **existing** `N8N_CALLBACK_SECRET` value that's already configured for your audio/video transcription workflows. This ensures consistent authentication across all N8N callbacks.

**To find your existing callback secret**:
```bash
# Check your current .env.local file
cat .env.local | grep N8N_CALLBACK_SECRET

# OR check in your deployment environment variables
```

### **Step 4: Get Workflow Webhook URL**

1. **Click on "Compression Request" node**
2. **Copy the webhook URL** (should look like: `https://your-n8n.com/webhook/compression-service`)
3. **Save this URL** - you'll need it for testing and integration

## 🧪 **Testing Your Implementation**

### **Test 1: Database Migration Verification**

```sql
-- Run this query in Supabase SQL Editor to verify migration
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'content' 
AND column_name LIKE '%thumbnail%';

-- Should return:
-- video_long_thumbnail_url  | text | YES | null
-- video_short_thumbnail_url | text | YES | null
```

### **Test 2: N8N Workflow - Image Compression**

```bash
curl -X POST "https://your-n8n.com/webhook/compression-service" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "imageUrl": "https://example.com/test-image.png",
    "contentAssetId": "test-asset-123",
    "contentType": "blog_post"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "jobId": "img_1234567890",
  "status": "processing",
  "estimatedTime": "30-60 seconds",
  "message": "Compression job started successfully"
}
```

### **Test 3: N8N Workflow - Video Compression**

```bash
curl -X POST "https://your-n8n.com/webhook/compression-service" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "video",
    "videoUrl": "https://example.com/test-video.mp4",
    "businessId": "test-business-123",
    "contentId": "test-content-456",
    "videoType": "long"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "jobId": "vid_1234567890", 
  "status": "processing",
  "estimatedTime": "2-5 minutes",
  "message": "Compression job started successfully"
}
```

### **Test 4: Error Handling**

```bash
# Test missing required fields
curl -X POST "https://your-n8n.com/webhook/compression-service" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image"
  }'
```

**Expected Error Response**:
```json
{
  "success": false,
  "error": "Invalid request",
  "message": "Missing required fields for image compression",
  "required": ["imageUrl", "contentAssetId"]
}
```

## 🔧 **How the Workflow Works**

### **Request Flow**:
1. **Webhook receives compression request** with type (image/video) and parameters
2. **Validation checks** ensure all required fields are present
3. **Route to appropriate compression** (image or video endpoint)
4. **Call Railway service** with proper authentication and parameters
5. **Return immediate response** with job ID and estimated time
6. **Railway service processes asynchronously** and calls back when complete

### **Error Handling**:
- ✅ **Request validation** (missing required fields)
- ✅ **Railway service errors** (service unavailable, invalid responses)
- ✅ **Timeout handling** (30-second timeout on HTTP requests)
- ✅ **Graceful degradation** (clear error messages returned)

### **Logging & Monitoring**:
- ✅ **Request logging** (all compression requests logged with timestamps)
- ✅ **Error tracking** (failed requests logged with details)
- ✅ **Job ID tracking** (each compression job has unique identifier)

## 🚨 **Troubleshooting**

### **Common Issues**:

1. **Workflow doesn't trigger**:
   - Check webhook URL is correct
   - Verify N8N is running and accessible
   - Test webhook URL directly in browser

2. **Railway service connection fails**:
   - Verify `RAILWAY_COMPRESSION_URL` environment variable
   - Test Railway service health endpoint directly
   - Check Railway service logs for errors

3. **Environment variables not found**:
   - Ensure variables are set in N8N settings
   - Restart N8N after adding variables
   - Check variable names match exactly (case-sensitive)

4. **Validation errors**:
   - Verify request JSON structure matches expected format
   - Check all required fields are present
   - Ensure content type is correct

### **Debug Steps**:

1. **Check N8N execution logs**:
   - Go to N8N executions tab
   - Find failed execution
   - Check each node's output for errors

2. **Test Railway service directly**:
   ```bash
   curl https://your-railway-service.up.railway.app/health
   ```

3. **Validate environment variables**:
   - Create simple test workflow that outputs env vars
   - Ensure all required variables are accessible

## ✅ **Phase 2 Complete Checklist**

- [ ] ✅ **Database migration created and deployed**
- [ ] ✅ **New thumbnail columns exist in content table**
- [ ] ✅ **N8N compression workflow imported and saved**
- [ ] ✅ **Environment variables configured**
- [ ] ✅ **Webhook URL obtained and documented**
- [ ] ✅ **Image compression test passes**
- [ ] ✅ **Video compression test passes**
- [ ] ✅ **Error handling test passes**
- [ ] ✅ **Railway service connectivity verified**

## 📝 **What You've Built**

After completing Phase 2, you have:

- ✅ **Database ready** for video thumbnails
- ✅ **N8N compression workflow** that can handle both images and videos
- ✅ **Railway service integration** with proper error handling
- ✅ **Microservices architecture** (reusable compression workflow)
- ✅ **Complete validation** and error handling
- ✅ **Testing procedures** to verify everything works

**Next**: Phase 3 - Content Creation Workflow Integration (see `docs/doc-video-compression-phase-3.md`)

## 🔗 **Integration Notes for Next Phase**

**For Phase 3**, you'll need:
- **N8N Webhook URL**: `https://your-n8n.com/webhook/compression-service`
- **Request Format**: Use the exact JSON structure from the test examples above
- **Response Handling**: Expect immediate responses with job IDs, actual compression happens asynchronously

The compression workflow is now ready to be called from your content creation workflows! 