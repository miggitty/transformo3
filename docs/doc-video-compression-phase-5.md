# Video & Image Compression - Phase 5: Testing & Deployment

## Overview

This document provides the **complete testing and deployment procedures** for Phase 5: Final testing, monitoring setup, and production deployment of the video and image compression system. After completing Phases 1-4, this phase ensures everything works correctly in production.

**⚠️ Prerequisites**: 
- ✅ Phase 1: Railway compression service deployed and tested
- ✅ Phase 2: N8N compression workflow deployed and tested  
- ✅ Phase 3: Content creation workflow with image compression deployed
- ✅ Phase 4: Video upload integration deployed

**✅ What You'll Complete**:
- Comprehensive testing procedures for all compression flows
- Production deployment checklist
- Monitoring and alerting setup
- Performance optimization
- Troubleshooting guides
- Documentation and training materials

## 🧪 **Comprehensive Testing Suite**

### **Test Environment Setup**

#### **Test Data Requirements**:
```
Test Images:
- Small PNG (< 1MB): 1080x1080 social post
- Medium PNG (2-3MB): 1280x720 blog image  
- Large PNG (5MB+): High-resolution image
- JPEG samples: Various qualities and sizes
- WebP samples: For format conversion testing

Test Videos:
- Small MP4 (< 50MB): 1-2 minute short video
- Medium MP4 (100-200MB): 5-10 minute long video
- Large MP4 (500MB+): High-quality long video
- Various resolutions: 1080x1080, 1280x720, 1920x1080
- Different codecs: H.264, H.265 (for compatibility testing)
```

#### **Test Environment Variables**:
```bash
# Add to test environment
COMPRESSION_TESTING_MODE=true
COMPRESSION_TEST_WEBHOOK_URL=https://webhook.site/your-test-url
COMPRESSION_MOCK_FAILURES=false
```

### **Test Suite 1: Image Compression (Content Creation)**

#### **Test 1.1: Blog Image Compression**
```bash
# Test script: test-blog-image-compression.sh
#!/bin/bash

echo "🧪 Testing Blog Image Compression..."

# Trigger content creation workflow
curl -X POST "https://your-n8n.com/webhook/content-creation" \
  -H "Content-Type: application/json" \
  -d '{
    "content_id": "test-blog-' $(date +%s) '",
    "business_id": "test-business-123",
    "blog_image_prompt": "A professional business meeting in a modern office"
  }'

echo "✅ Blog image compression test triggered"
echo "📊 Monitor N8N execution logs for compression workflow calls"
echo "🔍 Check Supabase storage for compressed images (.webp format)"
```

#### **Test 1.2: All Image Types Batch Test**
```typescript
// test-all-image-compression.ts
import { testImageCompression } from './utils/test-helpers'

const imageTypes = [
  { type: 'blog_post', size: '1280x720', quality: 85 },
  { type: 'youtube_video', size: '1280x720', quality: 85 },
  { type: 'social_post', size: '1080x1080', quality: 90 },
  { type: 'quote_card', size: '1080x1080', quality: 95 },
  { type: 'social_blog_post', size: '1280x720', quality: 85 }
]

async function testAllImageTypes() {
  console.log('🧪 Testing all image compression types...')
  
  for (const imageType of imageTypes) {
    try {
      const result = await testImageCompression(imageType)
      console.log(`✅ ${imageType.type}: ${result.reductionPercent}% reduction`)
      
      // Validate compression metrics
      if (result.reductionPercent < 30) {
        console.warn(`⚠️ Low compression ratio for ${imageType.type}`)
      }
      
      if (result.reductionPercent > 80) {
        console.warn(`⚠️ Very high compression ratio for ${imageType.type} - check quality`)
      }
      
    } catch (error) {
      console.error(`❌ ${imageType.type} compression failed:`, error)
    }
  }
}

testAllImageTypes()
```

### **Test Suite 2: Video Compression (Upload Integration)**

#### **Test 2.1: Video Upload Compression**
```typescript
// test-video-upload-compression.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testVideoUploadCompression() {
  console.log('🧪 Testing video upload compression...')
  
  const testVideoFile = new File(['test video content'], 'test-video.mp4', { 
    type: 'video/mp4' 
  })
  
  const contentId = `test-content-${Date.now()}`
  
  try {
    // 1. Upload video to Supabase
    console.log('📤 Uploading test video...')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(`${contentId}_video.mp4`, testVideoFile)
    
    if (uploadError) throw uploadError
    
    // 2. Trigger compression
    console.log('🔧 Triggering compression...')
    const response = await fetch('/api/video/finalize-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId,
        videoUrl: `https://supabase.co/storage/v1/object/public/videos/${uploadData.path}`,
        videoType: 'long'
      })
    })
    
    const result = await response.json()
    console.log('✅ Compression triggered:', result)
    
    // 3. Monitor compression progress via content status  
    if (result.jobId) {
      await monitorCompressionViaContent(contentId)
    }
    
  } catch (error) {
    console.error('❌ Video compression test failed:', error)
  }
}

async function monitorCompressionViaContent(contentId: string) {
  console.log('📊 Monitoring compression via content status:', contentId)
  
  let attempts = 0
  const maxAttempts = 60 // 5 minutes
  
  while (attempts < maxAttempts) {
    try {
      // Check content status in Supabase
      const { data: content, error } = await supabase
        .from('content')
        .select('status, video_long_url, video_long_thumbnail_url, updated_at')
        .eq('id', contentId)
        .single()
      
      if (error) {
        console.error('❌ Error fetching content:', error)
        break
      }
      
      console.log(`⏳ Attempt ${attempts + 1}: ${content.status}`)
      
      // Check if compression is complete (status changed from 'processing' and thumbnail exists)
      if (content.status === 'draft' && content.video_long_thumbnail_url) {
        console.log('✅ Compression completed successfully!')
        console.log(`🖼️ Thumbnail: ${content.video_long_thumbnail_url}`)
        console.log(`📹 Compressed video: ${content.video_long_url}`)
        break
      }
      
      if (content.status === 'error') {
        console.error('❌ Content processing failed')
        break
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000))
      attempts++
      
    } catch (error) {
      console.error('❌ Error monitoring content:', error)
      break
    }
  }
  
  if (attempts >= maxAttempts) {
    console.log('⚠️ Monitoring timed out after 5 minutes')
  }
}

// ✅ Note: monitorCompressionViaContent uses the same supabase client imported above

testVideoUploadCompression()
```

#### **Test 2.2: Large File Handling**
```bash
# test-large-video.sh
#!/bin/bash

echo "🧪 Testing large video file compression..."

# Create a large test video (or use existing)
LARGE_VIDEO="test-files/large-video-500mb.mp4"

if [ ! -f "$LARGE_VIDEO" ]; then
  echo "⚠️ Large test video not found. Please add a 500MB+ video to test-files/"
  exit 1
fi

echo "📁 Testing with file: $LARGE_VIDEO"
echo "📊 Original size: $(du -h "$LARGE_VIDEO" | cut -f1)"

# Upload via your app's video upload interface
echo "🚀 Upload this file through your app and monitor:"
echo "  1. Upload progress (should show TUS resumable upload)"
echo "  2. Compression progress (should show Railway processing)"
echo "  3. Final file size reduction (target: 60-80%)"
echo "  4. Thumbnail generation"
echo "  5. Transcription triggers correctly"
```

### **Test Suite 3: Error Handling & Fallbacks**

#### **Test 3.1: Railway Service Failure**
```bash
# test-compression-service-failure.sh
#!/bin/bash

echo "🧪 Testing compression service failure scenarios..."

# Temporarily disable Railway service or use invalid endpoint
export COMPRESSION_WORKFLOW_URL="https://invalid-url.com/webhook"

echo "🔧 Testing with invalid compression service URL..."
echo "📋 Expected behavior:"
echo "  ✅ Content creation should continue with original images"
echo "  ✅ Video uploads should proceed with original videos"
echo "  ✅ Transcription should work normally"
echo "  ✅ No broken workflows or stuck jobs"

# Trigger test workflows
echo "🚀 Trigger your workflows now and verify fallback behavior"
```

#### **Test 3.2: Network Timeout Handling**
```typescript
// test-timeout-handling.ts
import { setTimeout } from 'timers/promises'

async function testCompressionTimeouts() {
  console.log('🧪 Testing compression timeout handling...')
  
  // Test with very short timeout to force timeout error
  const originalTimeout = process.env.COMPRESSION_TIMEOUT
  process.env.COMPRESSION_TIMEOUT = '1000' // 1 second
  
  try {
    const result = await fetch('/api/compression/test-timeout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image',
        imageUrl: 'https://example.com/large-image.png'
      })
    })
    
    const data = await result.json()
    console.log('📊 Timeout test result:', data)
    
    // Restore original timeout
    process.env.COMPRESSION_TIMEOUT = originalTimeout
    
  } catch (error) {
    console.log('✅ Timeout handled correctly:', error.message)
  }
}

testCompressionTimeouts()
```

### **Test Suite 4: Performance & Load Testing**

#### **Test 4.1: Concurrent Compression Jobs**
```typescript
// test-concurrent-compression.ts
async function testConcurrentJobs() {
  console.log('🧪 Testing concurrent compression jobs...')
  
  const jobPromises = []
  const numberOfJobs = 10
  
  for (let i = 0; i < numberOfJobs; i++) {
    const jobPromise = fetch('/api/compression/test-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'image',
        testId: `concurrent-test-${i}`,
        imageUrl: `https://picsum.photos/1280/720?random=${i}`
      })
    })
    
    jobPromises.push(jobPromise)
  }
  
  console.log(`🚀 Starting ${numberOfJobs} concurrent compression jobs...`)
  const startTime = Date.now()
  
  try {
    const results = await Promise.all(jobPromises)
    const endTime = Date.now()
    
    console.log(`✅ All jobs completed in ${endTime - startTime}ms`)
    console.log(`📊 Average time per job: ${(endTime - startTime) / numberOfJobs}ms`)
    
    // Check success rate
    const successfulJobs = results.filter(r => r.ok).length
    console.log(`📈 Success rate: ${successfulJobs}/${numberOfJobs} (${(successfulJobs/numberOfJobs)*100}%)`)
    
  } catch (error) {
    console.error('❌ Concurrent job test failed:', error)
  }
}

testConcurrentJobs()
```

## 🚀 **Production Deployment Checklist**

### **Pre-Deployment Checks**

#### **Environment Verification**
- [ ] ✅ **Railway service** deployed and responding
- [ ] ✅ **N8N compression workflow** tested and active  
- [ ] ✅ **Database migrations** applied (video thumbnails, compression tracking)
- [ ] ✅ **Environment variables** set correctly in all environments
- [ ] ✅ **API endpoints** responding correctly
- [ ] ✅ **Webhook URLs** accessible from N8N and Railway
- [ ] ✅ **Supabase storage buckets** configured with proper permissions
- [ ] ✅ **SSL certificates** valid for all service endpoints

#### **Performance Verification**
- [ ] ✅ **Image compression** averaging 30-50% reduction
- [ ] ✅ **Video compression** averaging 60-80% reduction
- [ ] ✅ **Compression speed** under 30 seconds for typical files
- [ ] ✅ **Memory usage** stable on Railway service
- [ ] ✅ **N8N workflow execution** completing successfully
- [ ] ✅ **Database queries** performing efficiently
- [ ] ✅ **File upload/download** speeds acceptable

### **Deployment Steps**

#### **Step 1: Production Environment Setup**
```bash
# 1. Set production environment variables
export RAILWAY_ENV=production
export N8N_ENV=production
export SUPABASE_ENV=production

# 2. Update Next.js app environment variables
echo "🔧 Update these in Vercel/deployment platform:"
echo "COMPRESSION_WORKFLOW_URL=https://your-n8n.com/webhook/compression-service"
echo "N8N_TRANSCRIPTION_WORKFLOW_URL=https://your-n8n.com/webhook/video-transcription"
echo "COMPRESSION_CALLBACK_SECRET=your-production-secret-32-chars"
echo "NEXT_PUBLIC_APP_URL=https://your-production-domain.com"

# 3. Deploy Railway service to production
railway deploy --environment production

# 4. Verify Railway service health
curl -X GET "https://your-railway-service.com/health"
```

#### **Step 2: Database Migration**
```sql
-- Run this migration in production (if not already applied)
-- File: supabase/migrations/YYYYMMDDHHMMSS_add-compression-tracking.sql

-- Add compression tracking fields to content table
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS compression_job_id TEXT,
ADD COLUMN IF NOT EXISTS original_file_size BIGINT,
ADD COLUMN IF NOT EXISTS compressed_file_size BIGINT,
ADD COLUMN IF NOT EXISTS compression_ratio INTEGER,
ADD COLUMN IF NOT EXISTS compression_error TEXT;

-- Add video thumbnail fields
ALTER TABLE content 
ADD COLUMN IF NOT EXISTS video_long_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS video_short_thumbnail_url TEXT;

-- Create index for compression job lookups
CREATE INDEX IF NOT EXISTS idx_content_compression_job_id 
ON content(compression_job_id) 
WHERE compression_job_id IS NOT NULL;

-- Create index for processing status queries
CREATE INDEX IF NOT EXISTS idx_content_processing_status 
ON content(processing_status) 
WHERE processing_status IN ('compressing', 'compression_failed');
```

#### **Step 3: N8N Workflow Deployment**
```bash
# 1. Export development workflows
echo "📤 Export these workflows from development N8N:"
echo "  - Content Creation with Compression"
echo "  - Video Compression Service"  
echo "  - Video Transcription (Updated)"

# 2. Import to production N8N
echo "📥 Import workflows to production N8N"
echo "🔧 Update webhook URLs for production environment"
echo "🧪 Test all workflows with small test files"
```

#### **Step 4: App Deployment**
```bash
# 1. Deploy Next.js app with new compression features
git checkout main
git merge development-compression
npm run build
vercel deploy --prod

# 2. Verify deployment
curl -X GET "https://your-app.com/api/health"
```

#### **Step 5: Post-Deployment Verification**
```bash
# test-production-deployment.sh
#!/bin/bash

echo "🧪 Testing production deployment..."

# Test image compression via content creation
echo "📸 Testing image compression..."
curl -X POST "https://your-production-n8n.com/webhook/content-creation" \
  -H "Content-Type: application/json" \
  -d '{
    "content_id": "prod-test-'"$(date +%s)"'",
    "business_id": "test-business",
    "blog_image_prompt": "Professional headshot for LinkedIn"
  }'

# Test video compression via upload
echo "🎥 Testing video compression..."
# Upload test video through your app interface
# Monitor compression progress in Railway logs

# Test fallback scenarios
echo "🔄 Testing fallback scenarios..."
# Temporarily disable compression service
# Verify content creation still works with original images
```

## 📊 **Monitoring & Alerting Setup**

### **Railway Service Monitoring**

#### **Health Check Endpoint** (already in Phase 1):
```typescript
// In Railway service: src/routes/health.ts
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION || '1.0.0',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    activeJobs: compressionQueue.getActiveJobs().length,
    completedJobs: compressionQueue.getCompletedJobs().length,
    failedJobs: compressionQueue.getFailedJobs().length
  })
})
```

#### **Railway Monitoring Dashboard**:
1. **Add monitoring service** (Railway built-in or external)
2. **Set up alerts** for:
   - Service downtime
   - High memory usage (>80%)
   - Failed job rate (>10%)
   - Response time (>30 seconds)

### **N8N Workflow Monitoring**

#### **Webhook Monitoring**:
```javascript
// Add to N8N workflows for logging
const logNode = {
  "parameters": {
    "jsCode": `
// Enhanced logging for production monitoring
const executionData = {
  workflowId: $workflow.id,
  executionId: $execution.id,
  nodeId: $node.id,
  timestamp: new Date().toISOString(),
  input: $input.all(),
  success: true
};

// Log to external monitoring service
fetch('https://your-monitoring.com/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(executionData)
});

return $input.all();
    `
  },
  "name": "Monitor Execution",
  "type": "n8n-nodes-base.code"
}
```

### **Application Monitoring**

#### **Compression Metrics Dashboard**:
```typescript
// app/api/admin/compression-metrics/route.ts
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  
  // Get compression statistics
  const { data: stats } = await supabase
    .from('content')
    .select(`
      processing_status,
      original_file_size,
      compressed_file_size,
      compression_ratio,
      created_at
    `
```

## 📊 **Performance Monitoring**

### **Compression Metrics Dashboard**

Create monitoring endpoint for tracking compression performance:

```typescript
// app/api/admin/compression-metrics/route.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  
  // Get compression statistics from last 7 days
  const { data: stats } = await supabase
    .from('content')
    .select(`
      id,
      compression_job_id,
      original_file_size,
      compressed_file_size,
      compression_ratio,
      processing_status,
      created_at
    `)
    .not('compression_ratio', 'is', null)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  
  const metrics = {
    totalCompressed: stats?.length || 0,
    avgCompressionRatio: stats?.reduce((acc, item) => acc + (item.compression_ratio || 0), 0) / (stats?.length || 1),
    totalSpaceSaved: stats?.reduce((acc, item) => 
      acc + ((item.original_file_size || 0) - (item.compressed_file_size || 0)), 0),
    successRate: (stats?.filter(item => item.processing_status === 'compressed').length || 0) / (stats?.length || 1) * 100
  }
  
  return Response.json(metrics)
}
```

### **Error Tracking & Alerts**

#### **Critical Error Alerts**:
```typescript
// utils/alerting.ts
export async function sendCriticalAlert(error: {
  type: 'compression_failure' | 'service_down' | 'high_error_rate',
  message: string,
  metadata?: any
}) {
  
  // Send to Slack/Discord/Email
  const alertPayload = {
    text: `🚨 CRITICAL: ${error.type}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Error*: ${error.message}\n*Time*: ${new Date().toISOString()}\n*Environment*: ${process.env.NODE_ENV}`
        }
      }
    ]
  }
  
  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alertPayload)
  })
}
```

## 🆘 **Troubleshooting Guide**

### **Common Issues & Solutions**

#### **Issue 1: Compression Service Not Responding**
```bash
# Diagnosis
curl -X GET "https://your-railway-service.com/health"

# If unhealthy, check Railway logs:
railway logs --environment production

# Common causes:
# - Out of memory (increase Railway service memory)
# - Too many concurrent jobs (adjust MAX_CONCURRENT_JOBS)
# - Network connectivity issues

# Solution: Restart service
railway restart --environment production
```

#### **Issue 2: N8N Workflows Stuck**
```bash
# Check N8N execution logs
# Look for webhooks timing out

# Common causes:
# - Railway service overloaded
# - Network connectivity issues
# - Webhook URL misconfiguration

# Solution: Check webhook URLs and restart N8N if needed
```

#### **Issue 3: Images/Videos Not Compressing**
```typescript
// Debug compression flow
async function debugCompressionFlow(contentId: string) {
  console.log('🔍 Debugging compression for content:', contentId)
  
  // 1. Check if compression was triggered
  const { data: content } = await supabase
    .from('content')
    .select('*')
    .eq('id', contentId)
    .single()
  
  console.log('📊 Content record:', content)
  
  // 2. Check N8N execution logs
  console.log('📋 Check N8N for compression workflow execution')
  
  // 3. Check Railway service logs
  console.log('🏗️ Check Railway logs for job processing')
  
  // 4. Verify file URLs are accessible
  if (content?.video_long_url) {
    try {
      const response = await fetch(content.video_long_url, { method: 'HEAD' })
      console.log('📁 Video file accessible:', response.ok)
    } catch (error) {
      console.error('❌ Video file not accessible:', error)
    }
  }
}
```

### **Emergency Rollback Procedure**

#### **If Compression System Fails**:
```bash
# 1. Disable compression workflows in N8N
echo "🚨 Disable compression workflows to stop new jobs"

# 2. Update environment variables to skip compression
echo "COMPRESSION_ENABLED=false" >> .env.production

# 3. Deploy app update to bypass compression
git revert compression-commits
vercel deploy --prod

# 4. Re-enable original workflows
echo "📋 Activate original workflows without compression"
```

## ✅ **Phase 5 Complete**

After completing this phase, you have:

- ✅ **Comprehensive testing suite** for all compression scenarios
- ✅ **Production deployment checklist** with verification steps  
- ✅ **Monitoring and alerting** for all compression services
- ✅ **Performance optimization** for high-load scenarios
- ✅ **Troubleshooting guides** for common issues
- ✅ **Emergency rollback procedures** for critical failures

## 🎉 **Project Complete!**

Your video and image compression system is now:

### **Fully Operational**:
- ✅ **30-50% image compression** across all content types
- ✅ **60-80% video compression** with thumbnail extraction
- ✅ **Seamless integration** with existing workflows
- ✅ **Error handling and fallbacks** for reliability
- ✅ **Production monitoring** and alerting

### **Performance Benefits**:
- 📈 **Faster page loads** due to smaller file sizes
- 💰 **Reduced storage costs** on Supabase
- 🚀 **Better user experience** with optimized media
- 📱 **Mobile optimization** with WebP format adoption

### **Technical Achievement**:
- 🏗️ **Microservices architecture** with Railway + N8N + Next.js
- 🔄 **Asynchronous processing** for non-blocking uploads
- 📊 **Comprehensive monitoring** and error tracking
- 🛠️ **Industry-standard practices** following Netflix/YouTube patterns

**Your compression system is production-ready and optimized for scale!** 🚀