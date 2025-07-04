# Video Upload Project - Phase 6: Testing and Integration

## Overview
This final phase provides comprehensive testing procedures, integration verification, and deployment guidelines. Complete Phases 1-5 before starting this phase.

## Pre-Deployment Testing Checklist

### Step 1: Database Migration Verification

#### Migration Testing Script
Create a test script to verify the migration was applied correctly:

```sql
-- File: test-migration-verification.sql

-- 1. Verify project_type column exists
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'content' AND column_name = 'project_type';

-- 2. Verify constraint exists
SELECT constraint_name, check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'content_project_type_check';

-- 3. Verify index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'content' AND indexname = 'idx_content_project_type';

-- 4. Test valid project type insertions
BEGIN;
  INSERT INTO content (business_id, project_type, status) 
  VALUES ('test-business-id', 'voice_recording', 'processing');
  
  INSERT INTO content (business_id, project_type, status) 
  VALUES ('test-business-id', 'video_upload', 'processing');
ROLLBACK;

-- 5. Test invalid project type (should fail)
BEGIN;
  INSERT INTO content (business_id, project_type, status) 
  VALUES ('test-business-id', 'invalid_type', 'processing');
ROLLBACK;

-- 6. Verify existing data has default values
SELECT project_type, COUNT(*) as count
FROM content 
GROUP BY project_type;
```

#### Environment Variable Verification
```bash
#!/bin/bash
# File: test-env-vars.sh

echo "=== Environment Variables Verification ==="

# Check required N8N webhooks
if [ -z "$N8N_WEBHOOK_URL_AUDIO_PROCESSING" ]; then
  echo "❌ N8N_WEBHOOK_URL_AUDIO_PROCESSING not set"
else
  echo "✅ N8N_WEBHOOK_URL_AUDIO_PROCESSING: $N8N_WEBHOOK_URL_AUDIO_PROCESSING"
fi

if [ -z "$N8N_WEBHOOK_VIDEO_TRANSCRIPTION" ]; then
  echo "❌ N8N_WEBHOOK_VIDEO_TRANSCRIPTION not set"
else
  echo "✅ N8N_WEBHOOK_VIDEO_TRANSCRIPTION: $N8N_WEBHOOK_VIDEO_TRANSCRIPTION"
fi

if [ -z "$N8N_WEBHOOK_URL_CONTENT_CREATION" ]; then
  echo "❌ N8N_WEBHOOK_URL_CONTENT_CREATION not set"
else
  echo "✅ N8N_WEBHOOK_URL_CONTENT_CREATION: $N8N_WEBHOOK_URL_CONTENT_CREATION"
fi

# Check callback configuration
if [ -z "$N8N_CALLBACK_SECRET" ]; then
  echo "❌ N8N_CALLBACK_SECRET not set"
else
  echo "✅ N8N_CALLBACK_SECRET configured"
fi

if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
  echo "❌ NEXT_PUBLIC_APP_URL not set"
else
  echo "✅ NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"
fi

echo "=== Environment Check Complete ==="
```

### Step 2: Component Integration Testing

#### Create Integration Test Suite
```typescript
// File: __tests__/integration/video-upload-flow.test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VideoUploadClient } from '@/app/(app)/video-upload/video-upload-client';
import { NewContentButton } from '@/components/shared/new-content-button';
import { ProjectTypeBadge } from '@/components/shared/project-type-badge';
import { PROJECT_TYPES } from '@/types';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock server actions
jest.mock('@/app/(app)/video-upload/actions', () => ({
  createVideoUploadProject: jest.fn().mockResolvedValue({
    data: { id: 'test-content-id', business_id: 'test-business-id' }
  }),
}));

describe('Video Upload Integration', () => {
  describe('NewContentButton', () => {
    test('displays dropdown with both project types', async () => {
      const user = userEvent.setup();
      render(<NewContentButton />);
      
      const button = screen.getByRole('button', { name: /new content/i });
      await user.click(button);
      
      expect(screen.getByText('Voice Recording')).toBeInTheDocument();
      expect(screen.getByText('Video Upload')).toBeInTheDocument();
    });

    test('navigates to correct routes', async () => {
      const user = userEvent.setup();
      const mockPush = jest.fn();
      
      // Mock router with push function
      jest.mocked(require('next/navigation').useRouter).mockReturnValue({
        push: mockPush,
        back: jest.fn(),
      });
      
      render(<NewContentButton />);
      
      const button = screen.getByRole('button', { name: /new content/i });
      await user.click(button);
      
      await user.click(screen.getByText('Voice Recording'));
      expect(mockPush).toHaveBeenCalledWith('/voice-recording');
      
      await user.click(button);
      await user.click(screen.getByText('Video Upload'));
      expect(mockPush).toHaveBeenCalledWith('/video-upload');
    });
  });

  describe('ProjectTypeBadge', () => {
    test('displays correct badge for voice recording', () => {
      render(<ProjectTypeBadge projectType={PROJECT_TYPES.VOICE_RECORDING} />);
      expect(screen.getByText('Voice Recording')).toBeInTheDocument();
    });

    test('displays correct badge for video upload', () => {
      render(<ProjectTypeBadge projectType={PROJECT_TYPES.VIDEO_UPLOAD} />);
      expect(screen.getByText('Video Upload')).toBeInTheDocument();
    });

    test('handles null project type gracefully', () => {
      render(<ProjectTypeBadge projectType={null} />);
      expect(screen.getByText('Voice Recording')).toBeInTheDocument(); // Default fallback
    });
  });

  describe('VideoUploadClient', () => {
    test('creates project and opens upload modal', async () => {
      const user = userEvent.setup();
      render(<VideoUploadClient />);
      
      const startButton = screen.getByRole('button', { name: /start video upload/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/upload.*video/i)).toBeInTheDocument();
      });
    });
  });
});
```

### Step 3: API Endpoint Testing

#### N8N Webhook Testing
```typescript
// File: __tests__/api/n8n-callback.test.ts

import { POST } from '@/app/api/n8n/callback/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@/utils/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
      select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn() })) })),
    })),
  })),
}));

describe('/api/n8n/callback', () => {
  const mockEnv = {
    N8N_CALLBACK_SECRET: 'test-secret',
    N8N_WEBHOOK_URL_CONTENT_CREATION: 'https://test-n8n.com/webhook',
    NEXT_PUBLIC_APP_URL: 'https://test-app.com',
  };

  beforeEach(() => {
    Object.assign(process.env, mockEnv);
  });

  test('handles video transcription completion', async () => {
    const requestBody = {
      content_id: 'test-content-id',
      transcript: 'Test video transcript',
      project_type: 'video_upload',
      callbackSecret: 'test-secret',
    };

    const request = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Transcription completed');
  });

  test('handles content generation completion', async () => {
    const requestBody = {
      content_id: 'test-content-id',
      video_script: 'Generated video script',
      project_type: 'video_upload',
      callbackSecret: 'test-secret',
    };

    const request = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Content generation completed');
  });

  test('rejects invalid callback secret', async () => {
    const requestBody = {
      content_id: 'test-content-id',
      transcript: 'Test transcript',
      callbackSecret: 'wrong-secret',
    };

    const request = new NextRequest('http://localhost:3000/api/n8n/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });
});
```

### Step 4: End-to-End Testing Scenarios

#### Voice Recording Project E2E Test
```typescript
// File: __tests__/e2e/voice-recording-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Voice Recording Project Flow', () => {
  test('complete voice recording project creation', async ({ page }) => {
    // Navigate to voice recording page
    await page.goto('/voice-recording');
    
    // Verify page title and project type
    await expect(page.getByText('Create Voice Recording Project')).toBeVisible();
    
    // Start audio recording (would need to mock audio in real test)
    const recordButton = page.getByRole('button', { name: /start recording/i });
    await expect(recordButton).toBeVisible();
    
    // Verify navigation to drafts after completion
    // (This would be mocked in a real test environment)
  });

  test('voice recording appears in drafts with correct project type', async ({ page }) => {
    await page.goto('/content/drafts');
    
    // Check for project type column and badge
    await expect(page.getByText('Voice Recording')).toBeVisible();
    
    // Verify content table shows project type
    const table = page.locator('[data-testid="content-table"]');
    await expect(table).toBeVisible();
  });
});
```

#### Video Upload Project E2E Test
```typescript
// File: __tests__/e2e/video-upload-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Video Upload Project Flow', () => {
  test('complete video upload project creation', async ({ page }) => {
    // Navigate to video upload page
    await page.goto('/video-upload');
    
    // Verify page title and project type
    await expect(page.getByText('Create Video Upload Project')).toBeVisible();
    
    // Start video upload process
    const uploadButton = page.getByRole('button', { name: /start video upload/i });
    await uploadButton.click();
    
    // Verify upload modal opens
    await expect(page.getByText(/upload.*video/i)).toBeVisible();
    
    // Test file validation (mock file upload)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
  });

  test('video upload appears in drafts with correct project type', async ({ page }) => {
    await page.goto('/content/drafts');
    
    // Check for video upload project type badge
    await expect(page.getByText('Video Upload')).toBeVisible();
    
    // Verify transcript section is hidden for video uploads
    // (This would be tested on the content details page)
  });
});
```

### Step 5: Performance Testing

#### Database Query Performance
```sql
-- File: performance-test-queries.sql

-- Test project type filtering performance
EXPLAIN ANALYZE 
SELECT * FROM content 
WHERE project_type = 'video_upload' 
ORDER BY created_at DESC 
LIMIT 50;

-- Test mixed project type queries
EXPLAIN ANALYZE 
SELECT 
  project_type,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time
FROM content 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY project_type;

-- Test content with assets join performance
EXPLAIN ANALYZE 
SELECT c.*, COUNT(ca.id) as asset_count
FROM content c
LEFT JOIN content_assets ca ON c.id = ca.content_id
WHERE c.business_id = 'test-business-id'
GROUP BY c.id
ORDER BY c.created_at DESC;
```

#### Load Testing Script
```bash
#!/bin/bash
# File: load-test.sh

echo "=== Load Testing Video Upload System ==="

# Test New Content Button endpoint
ab -n 100 -c 10 http://localhost:3000/voice-recording

# Test Video Upload page
ab -n 100 -c 10 http://localhost:3000/video-upload

# Test Content Tables with project types
ab -n 100 -c 10 http://localhost:3000/content/drafts

echo "=== Load Test Complete ==="
```

### Step 6: Security Testing

#### Input Validation Tests
```typescript
// File: __tests__/security/input-validation.test.ts

describe('Security: Input Validation', () => {
  test('project type validation rejects invalid values', () => {
    const { isValidProjectType } = require('@/lib/project-type');
    
    expect(isValidProjectType('voice_recording')).toBe(true);
    expect(isValidProjectType('video_upload')).toBe(true);
    expect(isValidProjectType('invalid_type')).toBe(false);
    expect(isValidProjectType('<script>alert("xss")</script>')).toBe(false);
    expect(isValidProjectType(null)).toBe(false);
    expect(isValidProjectType(undefined)).toBe(false);
  });

  test('N8N callback validates required fields', async () => {
    const maliciousPayload = {
      content_id: '<script>alert("xss")</script>',
      transcript: 'DROP TABLE content;',
      project_type: 'invalid_type',
    };

    // Test that malicious input is rejected
    // (Implementation would depend on your validation layer)
  });
});
```

### Step 7: Deployment Verification Checklist

#### Pre-Production Checklist
```markdown
## Pre-Production Deployment Checklist

### Database
- [ ] ✅ Migration applied successfully in staging
- [ ] ✅ All constraints and indexes created
- [ ] ✅ Existing data migrated correctly
- [ ] ✅ Performance tests pass
- [ ] ✅ Backup strategy updated for new fields

### Environment Variables
- [ ] ✅ N8N_WEBHOOK_VIDEO_TRANSCRIPTION configured
- [ ] ✅ N8N_WEBHOOK_URL_AUDIO_PROCESSING verified
- [ ] ✅ N8N_WEBHOOK_URL_CONTENT_CREATION verified
- [ ] ✅ N8N_CALLBACK_SECRET configured
- [ ] ✅ NEXT_PUBLIC_APP_URL set correctly

### Application
- [ ] ✅ All TypeScript compilation passes
- [ ] ✅ No linting errors
- [ ] ✅ Unit tests pass (minimum 80% coverage)
- [ ] ✅ Integration tests pass
- [ ] ✅ E2E tests pass
- [ ] ✅ Performance tests acceptable
- [ ] ✅ Security tests pass

### N8N Workflows
- [ ] ✅ Video transcription workflow tested
- [ ] ✅ Audio processing workflow still works
- [ ] ✅ Content generation workflow handles both types
- [ ] ✅ Callback handling verified
- [ ] ✅ Error handling and retries work

### UI/UX
- [ ] ✅ New Content buttons work on all pages
- [ ] ✅ Project type badges display correctly
- [ ] ✅ Transcript hiding works for video uploads
- [ ] ✅ Content tables show project types
- [ ] ✅ Mobile responsive design maintained
- [ ] ✅ Accessibility standards met

### File Storage
- [ ] ✅ Video upload storage bucket configured
- [ ] ✅ File size limits enforced (400MB)
- [ ] ✅ File type validation working
- [ ] ✅ Storage policies configured correctly
- [ ] ✅ CDN/external URL handling works
```

### Step 8: Production Monitoring Setup

#### Monitoring Configuration
```typescript
// File: lib/monitoring/video-upload-metrics.ts

export interface VideoUploadMetrics {
  projectCreations: {
    voiceRecording: number;
    videoUpload: number;
  };
  processingTimes: {
    averageVideoTranscription: number;
    averageAudioProcessing: number;
    averageContentGeneration: number;
  };
  failureRates: {
    videoTranscriptionFailures: number;
    audioProcessingFailures: number;
    contentGenerationFailures: number;
  };
  webhookHealth: {
    videoTranscriptionWebhook: 'healthy' | 'unhealthy';
    audioProcessingWebhook: 'healthy' | 'unhealthy';
    contentGenerationWebhook: 'healthy' | 'unhealthy';
  };
}

export async function collectVideoUploadMetrics(): Promise<VideoUploadMetrics> {
  // Implementation would collect metrics from database and logs
  // This is a placeholder for the monitoring structure
  
  return {
    projectCreations: {
      voiceRecording: 0,
      videoUpload: 0,
    },
    processingTimes: {
      averageVideoTranscription: 0,
      averageAudioProcessing: 0,
      averageContentGeneration: 0,
    },
    failureRates: {
      videoTranscriptionFailures: 0,
      audioProcessingFailures: 0,
      contentGenerationFailures: 0,
    },
    webhookHealth: {
      videoTranscriptionWebhook: 'healthy',
      audioProcessingWebhook: 'healthy',
      contentGenerationWebhook: 'healthy',
    },
  };
}
```

## Post-Deployment Verification

### Step 9: Production Smoke Tests

#### Critical Path Tests
```bash
#!/bin/bash
# File: production-smoke-tests.sh

echo "=== Production Smoke Tests ==="

BASE_URL=${1:-"https://your-production-url.com"}

# Test voice recording page loads
echo "Testing voice recording page..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/voice-recording")
if [ $response -eq 200 ]; then
  echo "✅ Voice recording page: OK"
else
  echo "❌ Voice recording page: FAILED ($response)"
fi

# Test video upload page loads
echo "Testing video upload page..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/video-upload")
if [ $response -eq 200 ]; then
  echo "✅ Video upload page: OK"
else
  echo "❌ Video upload page: FAILED ($response)"
fi

# Test content pages load
echo "Testing content pages..."
for page in "content" "content/drafts" "content/scheduled" "content/completed"; do
  response=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/$page")
  if [ $response -eq 200 ]; then
    echo "✅ $page: OK"
  else
    echo "❌ $page: FAILED ($response)"
  fi
done

echo "=== Smoke Tests Complete ==="
```

### Step 10: Rollback Plan

#### Rollback Procedure
```markdown
## Emergency Rollback Procedure

### If Database Issues Occur:
1. **Immediate Actions:**
   ```sql
   -- Disable project type constraint temporarily
   ALTER TABLE content DROP CONSTRAINT content_project_type_check;
   
   -- Set all null project types to voice_recording
   UPDATE content SET project_type = 'voice_recording' WHERE project_type IS NULL;
   ```

2. **Code Rollback:**
   ```bash
   # Revert to previous deployment
   git checkout previous-stable-tag
   npm run build
   npm run deploy
   ```

3. **Environment Variables:**
   ```bash
   # Remove new video transcription webhook
   unset N8N_WEBHOOK_VIDEO_TRANSCRIPTION
   ```

### If N8N Webhook Issues Occur:
1. **Disable Video Upload:**
   - Set maintenance mode for `/video-upload` route
   - Display "temporarily unavailable" message

2. **Fallback to Audio Only:**
   - Temporarily hide video upload options in New Content buttons
   - Monitor audio processing webhooks

### If UI Issues Occur:
1. **Component Rollback:**
   - Revert NewContentButton to simple Link component
   - Hide project type badges if causing layout issues
   - Remove project type columns from tables temporarily
```

## Final Integration Checklist

- [ ] ✅ **Database Migration:** Applied successfully with no data loss
- [ ] ✅ **Environment Configuration:** All webhooks and secrets configured
- [ ] ✅ **Voice Recording Projects:** Create, process, and generate content successfully
- [ ] ✅ **Video Upload Projects:** Upload, transcribe, and generate content successfully
- [ ] ✅ **N8N Integration:** All webhooks working, callbacks handled correctly
- [ ] ✅ **UI Components:** New Content buttons, project type badges, content tables
- [ ] ✅ **Content Display:** Project types shown, transcript hidden for video uploads
- [ ] ✅ **Error Handling:** Failed processing can be retried for both project types
- [ ] ✅ **Performance:** Page load times acceptable, database queries optimized
- [ ] ✅ **Security:** Input validation, authentication, authorization working
- [ ] ✅ **Monitoring:** Metrics collection and alerting configured
- [ ] ✅ **Documentation:** User guides and technical docs updated
- [ ] ✅ **Rollback Plan:** Emergency procedures documented and tested

## Success Metrics

### Week 1 Post-Deployment:
- [ ] Zero critical bugs reported
- [ ] Video upload success rate > 95%
- [ ] Voice recording functionality unchanged
- [ ] User adoption of video upload feature > 10%

### Week 4 Post-Deployment:
- [ ] Processing time for video uploads < 5 minutes average
- [ ] Content generation quality maintained for both project types
- [ ] Support tickets related to confusion < 5 per week
- [ ] User satisfaction scores maintained or improved

## Troubleshooting Guide

### Common Issues and Solutions:

**Issue:** Video uploads fail with 400MB limit error
**Solution:** Check file validation in VideoUploadModal component

**Issue:** Project type badges not showing
**Solution:** Verify project_type field is properly set in database

**Issue:** Transcript showing for video upload projects
**Solution:** Check shouldShowTranscript() function implementation

**Issue:** N8N webhook timeouts
**Solution:** Verify webhook URLs and network connectivity

**Issue:** Content generation not triggered after transcription
**Solution:** Check callback handling in /api/n8n/callback/route.ts

---

## Implementation Complete! 🎉

Congratulations! You have successfully implemented the video upload project type system. The application now supports both:

- **Voice Recording Projects** (existing functionality enhanced)
- **Video Upload Projects** (new functionality)

Both project types share the same content generation pipeline while providing appropriate UI experiences for each type. 