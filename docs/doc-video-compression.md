# Video & Image Compression Implementation Guide

## Overview

This document provides the complete technical implementation guide for adding video and image compression to the Transformo app. The system will integrate Railway compression service with existing N8N workflows to automatically compress videos and images during upload and generation.

**⚠️ IMPORTANT**: This is a **PLANNING DOCUMENT**. None of the compression functionality described here has been implemented yet. This document serves as the roadmap for building the complete compression system from scratch.

## 🏗️ **Current Architecture Analysis**

### **Existing Infrastructure**
- **Frontend**: Next.js 15 with App Router
- **Database**: Supabase with existing content/content_assets tables
- **Storage**: Supabase Storage (images, videos, audio buckets)
- **Orchestration**: N8N workflows for content creation and workflow management
- **Authentication**: Supabase Auth integration
- **Hosting**: Vercel (frontend) + Supabase (backend)

### **Planned Compression Infrastructure** 
- **Compression Service**: [Railway](https://railway.com/) hosting Node.js + FFmpeg container
- **Workflow Integration**: N8N calls Railway compression service via HTTP APIs
- **Processing Flow**: N8N → Railway (compression) → Supabase (storage) → N8N (continue workflow)

### **Current Data Flow**
```
User Upload → Supabase Storage → N8N Webhook → Video Transcription → Content Generation
```

### **Current File Handling**
- **Videos**: Stored in `content` table (`video_long_url`, `video_short_url`)
- **Images**: Stored in `content_assets` table (`image_url` field)
- **Current Image Specs**: 1080x1080, 1280x720, PNG format, 100-200KB
- **Current Video Upload**: TUS resumable uploads, 8MB chunks

## 🔧 **Proposed Solution Architecture**

### **Enhanced Data Flow (With Railway Compression)**
```
User Upload → Supabase Storage → N8N Webhook → Railway Compression Service → Compressed Files → Supabase Storage → Database Update → Existing Workflow Continues
```

### **Service Architecture**
- **[Railway](https://railway.com/) Compression Service**: Dedicated Node.js + FFmpeg container for actual compression work
- **N8N Orchestration**: Workflow management that calls Railway service via HTTP APIs
- **Clear Separation**: Railway = Compression Engine, N8N = Workflow Coordinator  
- **File Replacement Strategy**: Industry-standard seamless replacement (Vimeo/YouTube approach)
- **Thumbnail Generation**: Static poster frames extracted from videos on Railway (aspect ratio matches source video)
- **Simplicity**: Single thumbnail per video (no UI/database complexity from multiple formats)

### **File Processing Workflow - Industry Standard Approach**

**Strategy**: Process during generation/upload, instant save (used by DALL-E, Midjourney, Netflix, YouTube)

#### **For Image Regeneration (Content Details Page):**
1. **User clicks "Regenerate"** → AI generates image (~15-30s)
2. **During generation wait time**: Call compression N8N workflow
3. **Compression workflow** → Railway service compresses image (~5-10s)
4. **Store compressed result** in `temporary_image_url` field
5. **Show final compressed image** in comparison modal
6. **Save is instant** - just moves compressed image to permanent location

#### **For Video Uploads (Upload Pages):**
1. **User uploads video** → Direct to Supabase Storage
2. **Immediately trigger compression** N8N workflow  
3. **Compression workflow** → Railway service processes video
4. **Replace original** with compressed version (same filename) - **Atomic replacement**
5. **Generate thumbnail** and upload
6. **Update database** with new URLs

**Benefits of This Approach:**
- ✅ **Industry Proven**: Same strategy used by all major platforms (DALL-E, Midjourney, Netflix, YouTube)
- ✅ **UX Best Practice**: Users expect instant save, compression during wait time
- ✅ **Simple Architecture**: No complex file versioning systems needed
- ✅ **Reusable Workflow**: Same compression service for all content types
- ✅ **Cost Efficient**: No backup files consuming storage
- ✅ **Maintains URLs**: All existing references remain valid

## 📊 **Database Schema Changes**

### **Content Table Additions**
```sql
-- Add thumbnail URL fields to content table
ALTER TABLE content ADD COLUMN video_long_thumbnail_url TEXT;
ALTER TABLE content ADD COLUMN video_short_thumbnail_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN content.video_long_thumbnail_url IS 'Thumbnail/poster frame URL for long video (aspect ratio matches source video)';
COMMENT ON COLUMN content.video_short_thumbnail_url IS 'Thumbnail/poster frame URL for short video (aspect ratio matches source video)';
```

### **No Changes to Content_Assets Table**
- ✅ Keep existing `image_url` field
- ✅ Compressed images replace original URLs
- ✅ No additional fields needed

## 🛠️ **Railway Compression Infrastructure**

**Platform**: [Railway](https://railway.com/) - Modern cloud platform for deploying applications and databases  
**Role**: Dedicated compression service that performs all video/image processing work  
**Integration**: Called by N8N workflows via HTTP APIs for compression tasks

**Railway Setup**: See `docs/doc-video-compression-phase-1.md` for complete Railway deployment guide with working compression code.

### **Technology Stack**
```dockerfile
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### **API Endpoints**

#### **1. Video Compression Endpoint**
```
POST /api/compress/video
Content-Type: application/json

{
  "videoUrl": "https://supabase-url/video.mp4",
  "businessId": "uuid",
  "contentId": "uuid", 
  "videoType": "long|short",
  "callbackUrl": "https://app-url/api/n8n/callback",
  "callbackSecret": "secret"
}

Response:
{
  "jobId": "uuid",
  "status": "processing",
  "estimatedTime": "2-5 minutes"
}
```

#### **2. Image Compression Endpoint**
```
POST /api/compress/image
Content-Type: application/json

{
  "imageUrl": "https://supabase-url/image.png",
  "contentAssetId": "uuid",
  "contentType": "blog_post|social_blog_post|youtube_video",
  "callbackUrl": "https://app-url/api/n8n/callback", 
  "callbackSecret": "secret"
}

Response:
{
  "jobId": "uuid", 
  "status": "processing",
  "estimatedTime": "30-60 seconds"
}
```

### **Compression Settings**

#### **Video Compression**
- **Codec**: H.264 (x264)
- **Quality**: CRF 23 (balanced quality/size)
- **Resolution**: Keep original (1080p/720p)
- **Bitrate**: Variable (target 70% reduction)
- **Format**: MP4
- **Thumbnail**: Extract poster frame at 2-second mark

#### **Image Compression**
- **Format**: PNG → WebP conversion
- **Quality**: 85% for photos, 95% for graphics
- **Resolution**: Keep existing (1080x1080, 1280x720)
- **Optimization**: Lossless compression where possible

## 🏗️ **N8N Workflow Architecture**

### **Separate Compression Workflow (Best Practice)**

Following microservices best practices, we create a **reusable compression workflow** that can be called from multiple workflows:

**Architecture:**
```
Main Workflows → Call → Compression N8N Workflow → Railway Service
```

**Benefits:**
- ✅ **Reusable**: Video upload + Image regeneration + Future content types
- ✅ **Maintainable**: One place to update compression logic
- ✅ **Scalable**: Easy to add new compression types
- ✅ **Simple**: Follows microservices pattern

### **1. Compression Workflow (New)**
```json
{
  "name": "Content Compression Service",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "compress",
        "options": {}
      },
      "id": "compression-webhook",
      "name": "Compression Request",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "{{$env.RAILWAY_COMPRESSION_URL}}/api/compress/{{$json.body.type}}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{$env.RAILWAY_API_KEY}}"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json.body }}"
      },
      "id": "call-railway-compression",
      "name": "Call Railway Compression",
      "type": "n8n-nodes-base.httpRequest"
    }
  ]
}
```

### **2. Integration Examples**

#### **Image Regeneration Integration:**
```javascript
// In image regeneration workflow, add compression step:
const compressionPayload = {
  type: 'image',
  imageUrl: temporaryImageUrl,
  contentAssetId: assetId,
  callbackUrl: `${process.env.N8N_CALLBACK_URL}/image-compression-complete`
};

// Call compression workflow
await fetch(`${process.env.N8N_COMPRESSION_WEBHOOK}`, {
  method: 'POST',
  body: JSON.stringify(compressionPayload)
});
```

#### **Video Upload Integration:**
```javascript
// In video transcription workflow, add compression step:
const compressionPayload = {
  type: 'video', 
  videoUrl: uploadedVideoUrl,
  contentId: contentId,
  callbackUrl: `${process.env.N8N_CALLBACK_URL}/video-compression-complete`
};

// Call compression workflow
await fetch(`${process.env.N8N_COMPRESSION_WEBHOOK}`, {
  method: 'POST',
  body: JSON.stringify(compressionPayload)
});
```

## 🔄 **Enhanced N8N Workflow Integration**

### **Modified Video Transcription Workflow**
The existing workflow will be enhanced with compression nodes inserted after video upload but before transcription:

```json
{
  "name": "Video Transcription with Compression",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "video-transcription",
        "options": {}
      },
      "id": "webhook-start",
      "name": "Start: Receive Video URL",
      "type": "n8n-nodes-base.webhook"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "{{$env.RAILWAY_COMPRESSION_URL}}/api/compress/video",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{$env.RAILWAY_API_KEY}}"
            },
            {
              "name": "Content-Type", 
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"videoUrl\": \"{{ $json.body.video_url }}\",\n  \"businessId\": \"{{ $json.body.business_id }}\",\n  \"contentId\": \"{{ $json.body.content_id }}\",\n  \"videoType\": \"long\",\n  \"callbackUrl\": \"{{$env.LOCAL_URL}}/api/n8n/callback\",\n  \"callbackSecret\": \"{{$env.CALLBACK_SECRET}}\"\n}"
      },
      "id": "trigger-video-compression",
      "name": "Trigger Video Compression",
      "type": "n8n-nodes-base.httpRequest"
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.status }}",
              "value2": "processing"
            }
          ]
        }
      },
      "id": "check-compression-status",
      "name": "Is Compression Processing?",
      "type": "n8n-nodes-base.if"
    },
    {
      "parameters": {
        "amount": 30,
        "unit": "seconds"
      },
      "id": "wait-compression",
      "name": "Wait for Compression",
      "type": "n8n-nodes-base.wait"
    },
    {
      "parameters": {
        "jsCode": "// This node will be triggered by Railway callback with compressed URLs\n// The callback will include:\n// - compressedVideoUrl\n// - thumbnailUrl\n// - originalVideoUrl\nreturn $input.all();"
      },
      "id": "receive-compression-callback",
      "name": "Receive Compression Results",
      "type": "n8n-nodes-base.code"
    },
    {
      "parameters": {
        "method": "PATCH",
        "url": "={{$env.SUPABASE_URL}}/rest/v1/content?id=eq.{{ $('Start: Receive Video URL').item.json.body.content_id }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "apikey",
              "value": "={{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
            },
            {
              "name": "Authorization", 
              "value": "=Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}"
            },
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"video_long_url\": \"{{ $json.compressedVideoUrl }}\",\n  \"video_long_thumbnail_url\": \"{{ $json.thumbnailUrl }}\"\n}"
      },
      "id": "update-compressed-urls",
      "name": "Update Compressed URLs",
      "type": "n8n-nodes-base.httpRequest"
    }
  ],
  "connections": {
    "Start: Receive Video URL": {
      "main": [
        [
          {
            "node": "Trigger Video Compression",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Trigger Video Compression": {
      "main": [
        [
          {
            "node": "Is Compression Processing?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Is Compression Processing?": {
      "main": [
        [
          {
            "node": "Wait for Compression",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Get Rev Job",
            "type": "main", 
            "index": 0
          }
        ]
      ]
    },
    "Wait for Compression": {
      "main": [
        [
          {
            "node": "Receive Compression Results",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Receive Compression Results": {
      "main": [
        [
          {
            "node": "Update Compressed URLs",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Update Compressed URLs": {
      "main": [
        [
          {
            "node": "Get Rev Job",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

### **Image Compression Integration**
For images generated by content creation workflows, add compression nodes:

```javascript
// Add after image generation, before database update
{
  "parameters": {
    "method": "POST",
    "url": "{{$env.RAILWAY_COMPRESSION_URL}}/api/compress/image",
    "sendBody": true,
    "jsonBody": "={\n  \"imageUrl\": \"{{ $json.imageUrl }}\",\n  \"contentAssetId\": \"{{ $json.contentAssetId }}\",\n  \"contentType\": \"{{ $json.contentType }}\",\n  \"callbackUrl\": \"{{$env.LOCAL_URL}}/api/n8n/callback\",\n  \"callbackSecret\": \"{{$env.CALLBACK_SECRET}}\"\n}"
  },
  "name": "Trigger Image Compression",
  "type": "n8n-nodes-base.httpRequest"
}
```

## 🔄 **Implementation Plan**

**Note**: This implementation follows the same proven architecture used by Vimeo, YouTube, Netflix, and other major video platforms for maximum reliability and industry alignment.

### **Phase 1: Railway Compression Service (Week 1)**
**Status**: 📋 **PLANNED - Complete Implementation Ready**

**Overview**: Deploy a fully working compression service on Railway with complete FFmpeg and Sharp implementations.

**See**: `docs/doc-video-compression-phase-1.md` for complete Railway setup and implementation

**What You'll Get**:
- ✅ **Complete working compression service code**
- ✅ **FFmpeg video compression (MP4 → H.264, 60-80% size reduction)**
- ✅ **Sharp image compression (PNG/JPG → WebP, 30-50% size reduction)**  
- ✅ **Thumbnail extraction for videos**
- ✅ **Supabase integration for file upload/download**
- ✅ **Full error handling and logging**
- ✅ **Ready-to-deploy Railway configuration**

### **Phase 2: Database Schema & N8N Workflow (Week 2)**
**Status**: 📋 **PLANNED - Complete Implementation Ready**

**Overview**: Set up database schema and create N8N compression workflow that integrates with Railway service.

**See**: `docs/doc-video-compression-phase-2.md` for complete implementation

**What You'll Get**:
- ✅ **Complete database migration** (video thumbnail fields)
- ✅ **N8N compression workflow** (microservices pattern)
- ✅ **Railway service integration** (HTTP requests)
- ✅ **Error handling and retry logic**
- ✅ **Testing procedures and validation**

### **Phase 3: Content Creation Workflow Integration (Week 2)**
**Status**: 📋 **PLANNED - Complete Implementation Ready**

**Overview**: Integrate compression into existing content creation workflow for automatic image compression.

**See**: `docs/doc-video-compression-phase-3.md` for complete implementation  

**What You'll Get**:
- ✅ **Updated content creation workflow** (with compression integration)
- ✅ **5 image types compressed automatically** (blog, YouTube, social, quote cards)
- ✅ **Seamless integration** (no UI changes required)
- ✅ **Complete deployment guide**

### **Phase 4: Video Upload Integration (Week 3)**
**Status**: 📋 **PLANNED - Complete Implementation Ready**

**Overview**: Integrate video compression into the video upload and processing flows in the app.

**See**: `docs/doc-video-compression-phase-4.md` for complete implementation

**What You'll Get**:
- ✅ **Updated video upload actions** (compression integration)
- ✅ **Modified N8N transcription workflow** (accepts compressed videos)
- ✅ **Database updates** (thumbnail URLs)
- ✅ **Progress indicators** (compression status in UI)
- ✅ **Error handling** (fallbacks for compression failures)

### **Phase 5: Testing & Deployment (Week 4)**
**Status**: 📋 **PLANNED - Complete Implementation Ready**

**Overview**: Comprehensive testing and production deployment of the complete compression system.

**Current Video Processing Flows** (To Be Modified):

1. **Video Upload Projects**: `app/(app)/video-upload/` 
   ```
   Current: Video Upload → Supabase Storage → N8N Transcription
   To Implement: Video Upload → **Compression** → Supabase Storage → N8N Transcription
   ```

2. **Content Details Video Uploads**: `app/(app)/content/[id]/`
   ```
   Current: Video Upload → Update Content Record → Optional Transcription
   To Implement: Video Upload → **Compression** → Update Content Record → Transcription
   ```

**Video Compression Integration Points**:

1. **Video Upload Actions** (`app/(app)/video-upload/actions.ts`):
   ```typescript
   export async function finalizeVideoUploadRecord(contentId: string, videoUrl: string) {
     // CURRENT: Direct transcription trigger
     // NEEDED: Add compression workflow call before transcription
     
     const compressionResult = await callCompressionWorkflow({
       video_url: videoUrl,
       video_type: "video",
       output_format: "mp4", 
       crf: 23,
       extract_thumbnails: true,
       thumbnail_aspect_ratio: "match_source" // Extract thumbnail at source video's aspect ratio
     });
     
     // Update content with compressed video and thumbnails
     await updateContentWithCompressedVideo({
       content_id: contentId,
       video_long_url: compressionResult.compressed_video_url,
       video_long_thumbnail_url: compressionResult.thumbnails.long,
       video_short_thumbnail_url: compressionResult.thumbnails.short
     });
     
     // Then trigger transcription with compressed video
   }
   ```

2. **Content Video Updates** (`app/(app)/content/[id]/actions.ts`):
   ```typescript
   // Add compression step in video URL update actions
   // Before updating content record with video URL
   ```

3. **Video Upload Modal** (`components/shared/video-upload-modal.tsx`):
   ```typescript
   // Add compression step after upload success, before finalization
   // Show compression progress to user during upload flow
   ```

**Database Schema Requirements**:
Already implemented in Phase 2:
- ✅ `video_long_thumbnail_url` - Thumbnail for long video (matches source aspect ratio)
- ✅ `video_short_thumbnail_url` - Thumbnail for short video (matches source aspect ratio)

**Video Compression Parameters**:
- **Input**: MP4, MOV, AVI, WebM (up to 400MB)
- **Output**: H.264 MP4, CRF 23 (broadcast quality)
- **Compression**: 60-80% file size reduction
- **Thumbnails**: Extract poster frames at source aspect ratio for both long and short videos
- **Processing Time**: +30-60 seconds (during upload wait)

**Implementation Steps**:

1. **Update Video Upload Flow**:
   - Modify `finalizeVideoUploadRecord()` to call compression workflow
   - Add compression between upload and transcription
   - Update database with compressed video URL and thumbnails

2. **Update Content Video Management**:
   - Add compression to video update actions in content details
   - Ensure both upload paths use compression

3. **Update N8N Callback Handling**:
   - Handle compression completion callbacks
   - Update content records with compressed video data
   - Trigger transcription after compression

4. **Add Progress Indicators**:
   - Show compression progress in video upload modal
   - Update status messages to include compression step

**Expected Benefits**:
- **Video File Sizes**: 300MB → 60-90MB (70-80% reduction)
- **Page Load Speed**: Faster video loading for users
- **Thumbnails**: Automatic poster frame extraction

**Integration Challenges**:
- **Processing Time**: Videos take longer to compress than images
- **User Experience**: Need clear progress indicators during compression
- **Error Handling**: Robust fallbacks if compression fails
- **Testing**: Validate compression doesn't break transcription quality

**Files to Update**:
- 📋 `app/(app)/video-upload/actions.ts` - Add compression before transcription
- 📋 `app/(app)/content/[id]/actions.ts` - Add compression to video updates  
- 📋 `components/shared/video-upload-modal.tsx` - Show compression progress
- 📋 `app/api/n8n/callback/route.ts` - Handle compression callbacks
- 📋 N8N video transcription workflows - Accept compressed video inputs

**Testing Checklist**:
- [ ] Upload 200MB+ video → Verify compression → Check final file size
- [ ] Confirm thumbnails are extracted and stored correctly  
- [ ] Verify transcription works with compressed videos
- [ ] Test compression failure scenarios and fallbacks
- [ ] Test processing times and user experience

### **Phase 6: Testing & Validation (Week 4)**

1. **Integration Testing**
   - Test compression with large video files
   - Validate thumbnail extraction quality
   - Test error scenarios and fallbacks

2. **User Experience Validation**
   - Verify progress indicators work correctly
   - Test compression during expected wait times
   - Validate no UI degradation

3. **Documentation & Maintenance**
   - Create operation guides
   - Document troubleshooting procedures
   - Plan regular maintenance schedules

## Next Steps & Action Items

### Implementation Order

**Phase 1 (Week 1): Infrastructure Setup**
1. **Build Railway Compression Service**:
   ```bash
   # Create Node.js + FFmpeg container
   # Implement image and video compression endpoints
   # Deploy to Railway and test functionality
   ```

2. **Database Schema Updates**:
   ```bash
   # Create migration for video thumbnail fields
   # Deploy to Supabase
   ```

**Phase 2 (Week 2): N8N Workflow Development**
1. **Create Compression Workflow**:
   - Build standalone compression N8N workflow
   - Integrate with Railway service
   - Test image and video compression

2. **Integrate with Content Creation Workflow**:
   - Modify existing content creation workflow
   - Add compression calls for all 5 image types
   - Update file handling to use WebP format

**Phase 3 (Week 3): Video Integration**
1. **Video Upload Integration**:
   ```typescript
   // File: app/(app)/video-upload/actions.ts
   // Add compression call in finalizeVideoUploadRecord()
   // Update flow: Upload → Compression → Transcription
   ```

2. **Content Details Video Integration**:
   ```typescript  
   // File: app/(app)/content/[id]/actions.ts
   // Add compression to video update actions
   ```

3. **User Experience Updates**:
   ```typescript
   // File: components/shared/video-upload-modal.tsx
   // Add compression progress indicators
   ```

### Testing Plan

**Phase 1 Testing**:
- [ ] Railway service image compression (PNG/JPG → WebP)
- [ ] Railway service video compression (MP4 → H.264)
- [ ] Thumbnail extraction functionality
- [ ] Performance benchmarks

**Phase 2 Testing**:
- [ ] N8N compression workflow functionality
- [ ] Content creation workflow integration
- [ ] All 5 image types compressed correctly
- [ ] File size reductions achieved (60-80%)
- [ ] WebP files stored in Supabase correctly

**Phase 3 Testing**:
- [ ] Large video upload (200MB+) compression
- [ ] Thumbnail extraction and storage
- [ ] Transcription with compressed videos
- [ ] Database updates with thumbnail URLs
- [ ] Progress indicators during compression
- [ ] Error handling and fallback scenarios

### Testing Targets

**Image Compression Targets**:
- **Storage Reduction**: 60-80% per content piece
- **Processing Time**: +10-15 seconds per image
- **Quality**: Visually identical WebP output
- **Reliability**: 99%+ compression success rate

**Video Compression Targets**:
- **Storage Reduction**: 60-80% per video file
- **Processing Time**: +30-60 seconds per video
- **Thumbnails**: Automatic extraction at source aspect ratio for both long and short videos
- **Quality**: Broadcast quality H.264 output

### Implementation Risks

**Technical Risks**:
- **Processing Time**: Videos may take 30-60s to compress
- **Quality Control**: Ensure compression doesn't degrade quality
- **Error Handling**: Need robust fallbacks for compression failures
- **Integration Complexity**: Multiple touchpoints across app and N8N

**Mitigation Strategies**:
- **Progressive Implementation**: Start with images, then add videos
- **Thorough Testing**: Test compression quality before deployment
- **Fallback Mechanisms**: If compression fails, proceed with original files
- **User Communication**: Clear progress indicators during compression

### Files to Create/Modify

**New Files**:
- [ ] Railway compression service (Node.js + FFmpeg)
- [ ] N8N compression workflow JSON
- [ ] Database migration for thumbnail fields
- [ ] Updated content creation N8N workflow JSON

**Modified Files**:
- [ ] `app/(app)/video-upload/actions.ts` - Add compression before transcription
- [ ] `app/(app)/content/[id]/actions.ts` - Add compression to video updates  
- [ ] `components/shared/video-upload-modal.tsx` - Show compression progress
- [ ] `app/api/n8n/callback/route.ts` - Handle compression callbacks

## 📊 **File Storage Strategy**

### **Naming Conventions (No Changes)**
- **Videos**: `{businessId}_{contentId}_{videoType}.{ext}`
- **Video Thumbnails**: `{businessId}_{contentId}_{videoType}_thumb.jpg`
- **Images**: `{contentAssetId}_{contentType}.{ext}`

### **Compression Process**
1. **Download** original from Supabase Storage
2. **Compress** using optimal settings
3. **Upload** compressed version (same filename - overwrites original)
4. **Upload** thumbnail (new filename for videos)
5. **Update** database with new URLs
6. **Cleanup** temporary files

### **File Format Strategy**
- **Videos**: Keep MP4 format, optimize encoding
- **Video Thumbnails**: JPEG format (optimal for photos)
- **Images**: PNG → WebP conversion

## 🔒 **Security & Error Handling**

### **Railway Service Security**
- **API Key Authentication**: Bearer token validation
- **Request Validation**: File URL verification
- **Rate Limiting**: Prevent abuse
- **Callback Security**: Secret verification

### **Error Handling**
- **Compression Failures**: Fall back to original files
- **Network Issues**: Retry mechanisms with exponential backoff
- **Storage Errors**: Comprehensive error logging
- **User Notifications**: Graceful degradation

### **Basic Monitoring**
- **Compression Success Rate**: Target >95%
- **Processing Time**: Video <5min, Images <1min
- **Error Rates**: Basic error logging and alerts

## 🚀 **Deployment Checklist**

### **Pre-Deployment**
- [ ] Railway service tested and deployed
- [ ] Database migration created and tested
- [ ] N8N workflow backup completed
- [ ] Development environment tested

### **Deployment Day**
- [ ] Deploy database migration
- [ ] Update N8N workflow with compression nodes
- [ ] Deploy callback handler updates
- [ ] Update environment variables

### **Post-Deployment**
- [ ] Verify compression job success rates
- [ ] Verify existing UI functionality unchanged
- [ ] Test video uploads end-to-end
- [ ] Check error rates and logs

---

## 🔗 **Related Documentation**
- [Video Upload Phase Documentation](./video-upload-phase-1-database-infrastructure.md)
- [N8N Content Creation Workflow](./n8n-content-creation-callback-setup.md)
- [Image Regeneration System](./image-regeneration.md)
- [Supabase Storage Configuration](./supabase/)

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Next Review**: February 2025 

## Current Implementation Status

**📋 All Planned - Nothing Implemented Yet**:
- Railway compression service (will support both images and videos)
- Database schema updates (thumbnail fields to be added)
- N8N compression workflow (to handle both images and videos)
- Image compression integration (to be integrated into content creation workflow)
- Video compression integration (to be integrated into video upload flows)

**⚠️ Important Note**: This entire document is a **PLAN** for implementing compression. The compression service, N8N workflow integration, and all app integrations are **NOT YET IMPLEMENTED**. This is the roadmap for building the compression system.

## Architecture Overview

### Planned Architecture

**📋 Infrastructure Layer (To Be Built)**:
```
Railway Compression Service (Node.js + FFmpeg) - PLANNED
├── Image compression: PNG/JPG → WebP (TO IMPLEMENT)
├── Video compression: MP4/MOV → H.264 MP4 (TO IMPLEMENT)
└── Thumbnail extraction (TO IMPLEMENT)
```

**📋 Database Layer (To Be Updated)**:
```
Supabase - PLANNED CHANGES
├── content.video_long_thumbnail_url (TO ADD)
├── content.video_short_thumbnail_url (TO ADD)  
└── Images stored as WebP in storage (TO IMPLEMENT)
```

**📋 N8N Integration Layer (To Be Built)**:
```
N8N Workflows - PLANNED
├── Compression workflow (TO CREATE)
├── Content creation workflow integration (TO MODIFY)
└── Video workflow integration (TO MODIFY)
```

**📋 Application Layer (To Be Modified)**:
```
Next.js App - PLANNED CHANGES
├── Image compression: Content creation → Compression → Storage (TO IMPLEMENT)
├── Video upload: Upload → Compression → Storage → Transcription (TO IMPLEMENT)
└── Content videos: Upload → Compression → Storage (TO IMPLEMENT)
```

### Target Architecture (When Complete)

The compression system will integrate into existing workflows **during natural wait times**:

**Image Compression Flow** (To Be Implemented):
```
AI Image Generation (15-30s) → **Compression (2-5s)** → Storage → Display
```

**Video Compression Flow** (To Be Implemented):
```
Video Upload (30-120s) → **Compression (30-60s)** → Storage → Transcription
``` 