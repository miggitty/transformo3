# Content Pages Implementation Guide: PHASE 1 - Server Actions & Database

**Companion to**: [Content Management Pages PRD](./content-pages-draft-schedule-completed.md)  
**Implementation Phase**: 1 of 3 (Core Backend Logic)  
**Version**: 1.0  
**Date**: December 30, 2024

---

## **Phase 1 Overview: Backend Foundation**

**Goal**: Implement all server-side logic and database patterns before building UI components.

**Why Phase 1 First?**
- Server actions are the foundation that components depend on
- Database schema and status logic must be solid before UI implementation
- Error handling patterns need to be established at the data layer
- Testing backend logic is easier without UI complexity

**Estimated Timeline**: 1-2 weeks  
**Dependencies**: None (can start immediately)  
**Next Phase**: [Phase 2 - Component Usage Guide](./content-pages-phase2-component-guide.md)

---

## **1. Status Determination Logic**

### **1.1 Core Status Function**

```typescript
// app/lib/content-status.ts
import { Tables } from '@/types/supabase';

export type ContentStatus = 'processing' | 'failed' | 'draft' | 'scheduled' | 'partially-published' | 'completed';

export interface ContentWithAssets {
  content: Tables<'content'>;
  assets: Tables<'content_assets'>[];
}

/**
 * Determines the current status of content based on content state and assets
 * This is the core business logic for the 4-page content management system
 */
export function determineContentStatus(
  content: Tables<'content'>, 
  assets: Tables<'content_assets'>[]
): ContentStatus {
  // Processing: Audio still being processed or content generation in progress
  if (content.status === 'processing' || content.content_generation_status === 'generating') {
    return 'processing';
  }
  
  // Failed: Content generation failed or has no assets after completion
  if (content.content_generation_status === 'failed' || 
      (content.status === 'completed' && assets.length === 0)) {
    return 'failed';
  }
  
  // Asset-based status determination
  const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at);
  const sentAssets = assets.filter(asset => asset.asset_status === 'Sent');
  
  // Completed: All assets have been sent successfully
  if (assets.length > 0 && sentAssets.length === assets.length) {
    return 'completed';
  }
  
  // Partially Published: Some assets sent, some pending/failed
  if (sentAssets.length > 0 && sentAssets.length < assets.length) {
    return 'partially-published';
  }
  
  // Scheduled: Assets have scheduled dates but none sent yet
  if (scheduledAssets.length > 0 && sentAssets.length === 0) {
    return 'scheduled';
  }
  
  // Draft: Content is complete but no assets scheduled
  return 'draft';
}

/**
 * Determines if content can be scheduled (all assets must be approved)
 */
export function canScheduleContent(assets: Tables<'content_assets'>[]): boolean {
  if (assets.length === 0) return false;
  return assets.every(asset => asset.approved === true);
}

/**
 * Gets content suitable for specific page/status
 */
export function filterContentByStatus(
  contentList: ContentWithAssets[], 
  targetStatus: ContentStatus
): ContentWithAssets[] {
  return contentList.filter(({ content, assets }) => {
    const status = determineContentStatus(content, assets);
    
    // Special case: failed content appears in drafts
    if (targetStatus === 'draft') {
      return status === 'draft' || status === 'failed';
    }
    
    return status === targetStatus;
  });
}
```

### **1.2 Database Query Optimizations**

```typescript
// app/lib/content-queries.ts
import { createClient } from '@/utils/supabase/server';
import { ContentStatus } from './content-status';

/**
 * Optimized query for content with assets - uses joins to minimize database calls
 */
export async function getContentWithAssets(businessId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('content')
    .select(`
      *,
      content_assets (
        id,
        content_type,
        headline,
        content,
        asset_status,
        asset_scheduled_at,
        asset_published_at,
        approved,
        blog_meta_description,
        blog_url
      )
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching content with assets:', error);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

/**
 * Filtered query for specific content status with pagination
 */
export async function getFilteredContent({
  businessId,
  status,
  searchQuery,
  page = 1,
  pageSize = 50,
  startDate,
  endDate,
}: {
  businessId: string;
  status: ContentStatus;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from('content')
    .select(`
      *,
      content_assets (
        id,
        content_type,
        headline,
        content,
        asset_status,
        asset_scheduled_at,
        asset_published_at,
        approved,
        blog_meta_description,
        blog_url
      )
    `, { count: 'exact' })
    .eq('business_id', businessId);

  // Apply search filter
  if (searchQuery) {
    query = query.ilike('content_title', `%${searchQuery}%`);
  }

  // Apply date range filter
  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  // Order by creation date (newest first)
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching filtered content:', error);
    return { data: [], error, count: 0 };
  }

  // Filter by status on the application side (since we need asset analysis)
  const contentWithAssets = (data || []).map(content => ({
    content,
    assets: content.content_assets || []
  }));

  const filteredContent = filterContentByStatus(contentWithAssets, status);

  return { 
    data: filteredContent, 
    error: null, 
    count: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize)
  };
}
```

---

## **2. Delete Content Server Action**

### **2.1 Comprehensive Delete Implementation**

```typescript
// app/(app)/content/[id]/actions.ts
'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface DeleteContentResult {
  success: boolean;
  error?: string;
  deletedFiles?: {
    images: string[];
    videos: string[];
    audio: string[];
  };
}

/**
 * Hard delete content with comprehensive cleanup
 * Order is critical: files first, then database records
 */
export async function deleteContent({
  contentId,
  businessId,
}: {
  contentId: string;
  businessId: string;
}): Promise<DeleteContentResult> {
  const supabase = await createClient();
  
  try {
    // Step 1: Get content assets for cleanup tracking
    const { data: assets } = await supabase
      .from('content_assets')
      .select('id, content_type')
      .eq('content_id', contentId);

    const deletedFiles = {
      images: [] as string[],
      videos: [] as string[],
      audio: [] as string[]
    };

    // Step 2: Delete images from storage
    const { data: imageFiles } = await supabase
      .storage
      .from('images')
      .list('', { search: contentId });

    if (imageFiles && imageFiles.length > 0) {
      const imageFilenames = imageFiles.map(file => file.name);
      const { error: imageDeleteError } = await supabase
        .storage
        .from('images')
        .remove(imageFilenames);
      
      if (imageDeleteError) {
        console.error('Error deleting images:', imageDeleteError);
        // Continue with deletion - don't fail entirely for storage issues
      } else {
        deletedFiles.images = imageFilenames;
      }
    }

    // Step 3: Delete videos from storage
    const { data: videoFiles } = await supabase
      .storage
      .from('videos')
      .list('', { search: contentId });

    if (videoFiles && videoFiles.length > 0) {
      const videoFilenames = videoFiles.map(file => file.name);
      const { error: videoDeleteError } = await supabase
        .storage
        .from('videos')
        .remove(videoFilenames);
      
      if (videoDeleteError) {
        console.error('Error deleting videos:', videoDeleteError);
      } else {
        deletedFiles.videos = videoFilenames;
      }
    }

    // Step 4: Delete audio from storage
    const { data: audioFiles } = await supabase
      .storage
      .from('audio')
      .list('', { search: contentId });

    if (audioFiles && audioFiles.length > 0) {
      const audioFilenames = audioFiles.map(file => file.name);
      const { error: audioDeleteError } = await supabase
        .storage
        .from('audio')
        .remove(audioFilenames);
      
      if (audioDeleteError) {
        console.error('Error deleting audio:', audioDeleteError);
      } else {
        deletedFiles.audio = audioFilenames;
      }
    }

    // Step 5: Delete content assets from database
    const { error: assetsDeleteError } = await supabase
      .from('content_assets')
      .delete()
      .eq('content_id', contentId);

    if (assetsDeleteError) {
      throw new Error(`Failed to delete content assets: ${assetsDeleteError.message}`);
    }

    // Step 6: Delete content record from database
    const { error: contentDeleteError } = await supabase
      .from('content')
      .delete()
      .eq('id', contentId)
      .eq('business_id', businessId); // Security: ensure user can only delete their content

    if (contentDeleteError) {
      throw new Error(`Failed to delete content: ${contentDeleteError.message}`);
    }

    // Step 7: Revalidate all content pages
    revalidatePath('/content/drafts');
    revalidatePath('/content/scheduled');
    revalidatePath('/content/partially-published');
    revalidatePath('/content/completed');
    revalidatePath('/content');

    return { 
      success: true, 
      deletedFiles 
    };

  } catch (error) {
    console.error('Error in deleteContent:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete content' 
    };
  }
}
```

### **2.2 Validation for Delete Restrictions**

```typescript
/**
 * Check if content can be deleted based on business rules
 */
export async function canDeleteContent({
  contentId,
  businessId
}: {
  contentId: string;
  businessId: string;
}): Promise<{ canDelete: boolean; reason?: string }> {
  const supabase = await createClient();

  // Get content with assets to check status
  const { data: content } = await supabase
    .from('content')
    .select(`
      *,
      content_assets (
        id,
        asset_status,
        asset_published_at
      )
    `)
    .eq('id', contentId)
    .eq('business_id', businessId)
    .single();

  if (!content) {
    return { canDelete: false, reason: 'Content not found' };
  }

  const status = determineContentStatus(content, content.content_assets || []);

  // Business rule: Cannot delete completed content
  if (status === 'completed') {
    return { 
      canDelete: false, 
      reason: 'Cannot delete completed content. All content assets have been published.' 
    };
  }

  // All other statuses can be deleted
  return { canDelete: true };
}
```

---

## **3. Retry Content Server Action**

### **3.1 Retry Implementation with N8N Integration**

```typescript
/**
 * Retry failed content generation by triggering N8N workflow
 */
export async function retryContentProcessing({
  contentId,
  businessId
}: {
  contentId: string;
  businessId?: string; // Optional for additional security
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    // Step 1: Validate content exists and is in a retryable state
    const { data: content, error: fetchError } = await supabase
      .from('content')
      .select('id, business_id, content_generation_status, status, audio_url')
      .eq('id', contentId)
      .single();

    if (fetchError || !content) {
      return { success: false, error: 'Content not found' };
    }

    // Security check
    if (businessId && content.business_id !== businessId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Only retry failed content
    if (content.content_generation_status !== 'failed' && content.status !== 'completed') {
      return { success: false, error: 'Content is not in a retryable state' };
    }

    // Step 2: Reset content status to processing
    const { error: updateError } = await supabase
      .from('content')
      .update({
        content_generation_status: 'generating',
        status: 'processing'
      })
      .eq('id', contentId);

    if (updateError) {
      return { success: false, error: 'Failed to update content status' };
    }

    // Step 3: Trigger N8N content creation workflow
    const n8nWebhookUrl = process.env.N8N_CONTENT_CREATION_WEBHOOK_URL;
    const n8nSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!n8nWebhookUrl || !n8nSecret) {
      // Revert status change
      await supabase
        .from('content')
        .update({
          content_generation_status: 'failed',
          status: 'completed'
        })
        .eq('id', contentId);

      return { success: false, error: 'N8N configuration missing' };
    }

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${n8nSecret}`
      },
      body: JSON.stringify({
        contentId,
        businessId: content.business_id,
        audioUrl: content.audio_url,
        isRetry: true
      })
    });

    if (!response.ok) {
      // Revert status change
      await supabase
        .from('content')
        .update({
          content_generation_status: 'failed',
          status: 'completed'
        })
        .eq('id', contentId);

      return { success: false, error: 'Failed to trigger content generation workflow' };
    }

    // Step 4: Revalidate pages
    revalidatePath('/content/drafts');
    revalidatePath('/content');

    return { success: true };

  } catch (error) {
    console.error('Error in retryContentProcessing:', error);
    
    // Attempt to revert status on error
    try {
      await supabase
        .from('content')
        .update({
          content_generation_status: 'failed',
          status: 'completed'
        })
        .eq('id', contentId);
    } catch (revertError) {
      console.error('Failed to revert content status:', revertError);
    }

    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to retry content processing' 
    };
  }
}
```

---

## **4. Approval Workflow Server Actions**

### **4.1 Content Asset Approval**

```typescript
/**
 * Approve a content asset for scheduling
 */
export async function approveContentAsset({
  assetId,
  businessId
}: {
  assetId: string;
  businessId: string;
}): Promise<{ success: boolean; error?: string; allApproved?: boolean }> {
  const supabase = await createClient();

  try {
    // Step 1: Update the asset approval status
    const { data: updatedAsset, error: updateError } = await supabase
      .from('content_assets')
      .update({ approved: true })
      .eq('id', assetId)
      .select('content_id')
      .single();

    if (updateError || !updatedAsset) {
      return { success: false, error: 'Failed to approve content asset' };
    }

    // Step 2: Check if all assets for this content are now approved
    const { data: allAssets } = await supabase
      .from('content_assets')
      .select('id, approved')
      .eq('content_id', updatedAsset.content_id);

    const allApproved = allAssets?.every(asset => asset.approved === true) || false;

    // Step 3: Revalidate content pages
    revalidatePath(`/content/${updatedAsset.content_id}`);
    revalidatePath('/content/drafts');

    return { 
      success: true, 
      allApproved 
    };

  } catch (error) {
    console.error('Error in approveContentAsset:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to approve content asset' 
    };
  }
}

/**
 * Unapprove a content asset (remove approval)
 */
export async function unapproveContentAsset({
  assetId,
  businessId
}: {
  assetId: string;
  businessId: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  try {
    const { error: updateError } = await supabase
      .from('content_assets')
      .update({ approved: false })
      .eq('id', assetId);

    if (updateError) {
      return { success: false, error: 'Failed to unapprove content asset' };
    }

    // Revalidate to update UI
    revalidatePath('/content/drafts');

    return { success: true };

  } catch (error) {
    console.error('Error in unapproveContentAsset:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to unapprove content asset' 
    };
  }
}
```

---

## **5. Unschedule Content Server Action**

### **5.1 Flexible Unscheduling Implementation**

```typescript
/**
 * Unschedule content assets
 */
export async function unscheduleContent({
  contentId,
  type = 'all',
  businessId
}: {
  contentId: string;
  type: 'all' | 'remaining';
  businessId: string;
}): Promise<{ success: boolean; error?: string; unscheduledCount?: number }> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from('content_assets')
      .update({ 
        asset_scheduled_at: null,
        asset_status: 'Draft' 
      })
      .eq('content_id', contentId);

    // If 'remaining', only unschedule assets that haven't been sent
    if (type === 'remaining') {
      query = query.neq('asset_status', 'Sent');
    }

    const { data: unscheduledAssets, error: updateError } = await query.select('id');

    if (updateError) {
      return { success: false, error: 'Failed to unschedule content' };
    }

    // Revalidate all content pages since status may have changed
    revalidatePath(`/content/${contentId}`);
    revalidatePath('/content/drafts');
    revalidatePath('/content/scheduled');
    revalidatePath('/content/partially-published');

    return { 
      success: true, 
      unscheduledCount: unscheduledAssets?.length || 0 
    };

  } catch (error) {
    console.error('Error in unscheduleContent:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to unschedule content' 
    };
  }
}
```

---

## **6. Error Handling Patterns**

### **6.1 Standard Error Response Type**

```typescript
// app/lib/types.ts
export interface ServerActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

export interface ServerActionError {
  message: string;
  code?: string;
  statusCode?: number;
  originalError?: Error;
}
```

### **6.2 Error Wrapper for Server Actions**

```typescript
// app/lib/server-action-utils.ts
import { ServerActionResult } from './types';

/**
 * Wrapper for server actions to provide consistent error handling
 */
export async function withErrorHandling<T>(
  action: () => Promise<T>,
  errorContext: string
): Promise<ServerActionResult<T>> {
  try {
    const data = await action();
    return { success: true, data };
  } catch (error) {
    console.error(`${errorContext}:`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
      errorCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Usage example:
 */
export async function safeDeleteContent(params: DeleteContentParams) {
  return withErrorHandling(
    () => deleteContent(params),
    'Delete Content Action'
  );
}
```

---

## **7. Database Index Recommendations**

### **7.1 Performance Indexes**

```sql
-- Content table indexes for filtering and sorting
CREATE INDEX IF NOT EXISTS idx_content_business_created 
ON content(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_status_generation 
ON content(business_id, status, content_generation_status);

-- Content assets indexes for status determination
CREATE INDEX IF NOT EXISTS idx_content_assets_content_status 
ON content_assets(content_id, asset_status);

CREATE INDEX IF NOT EXISTS idx_content_assets_scheduled 
ON content_assets(content_id, asset_scheduled_at) 
WHERE asset_scheduled_at IS NOT NULL;

-- Approval workflow index (already mentioned in PRD)
CREATE INDEX IF NOT EXISTS idx_content_assets_approved 
ON content_assets(approved);

-- Search optimization
CREATE INDEX IF NOT EXISTS idx_content_title_search 
ON content USING gin(to_tsvector('english', content_title));
```

### **7.2 Query Performance Tips**

```typescript
// Efficient status queries - avoid N+1 problems
const efficientQuery = supabase
  .from('content')
  .select(`
    id,
    content_title,
    status,
    content_generation_status,
    created_at,
    content_assets!inner (
      asset_status,
      asset_scheduled_at,
      approved
    )
  `)
  .eq('business_id', businessId);

// Use .single() for unique lookups
const singleContent = await supabase
  .from('content')
  .select('*')
  .eq('id', contentId)
  .single(); // Throws error if not exactly 1 result
```

---

## **Phase 1 Implementation Checklist**

### **✅ Database & Schema**
- [ ] Add `approved` boolean field to `content_assets` table
- [ ] Create performance indexes (see section 7.1)
- [ ] Test migration on development database

### **✅ Core Logic Functions**
- [ ] Implement `determineContentStatus()` function
- [ ] Implement `canScheduleContent()` function  
- [ ] Implement `filterContentByStatus()` function
- [ ] Add comprehensive unit tests for status logic

### **✅ Server Actions**
- [ ] Implement `deleteContent()` with storage cleanup
- [ ] Implement `retryContentProcessing()` with N8N integration
- [ ] Implement `approveContentAsset()` and `unapproveContentAsset()`
- [ ] Implement `unscheduleContent()` action
- [ ] Add `canDeleteContent()` validation function

### **✅ Database Queries**
- [ ] Implement `getContentWithAssets()` optimized query
- [ ] Implement `getFilteredContent()` with pagination
- [ ] Test query performance with large datasets

### **✅ Error Handling**
- [ ] Create `ServerActionResult` type definitions
- [ ] Implement `withErrorHandling()` wrapper
- [ ] Add comprehensive error logging
- [ ] Test error scenarios and rollback mechanisms

### **✅ Testing & Validation**
- [ ] Test all server actions with real data
- [ ] Validate status determination logic with edge cases
- [ ] Test N8N webhook integration
- [ ] Verify storage cleanup works correctly
- [ ] Test approval workflow end-to-end

---

## **Implementation Notes**

### **Security Considerations**
- All server actions include `businessId` checks for RLS compliance
- File deletion uses content ID patterns to prevent unauthorized access
- N8N webhook includes authorization headers
- Input validation on all parameters

### **Performance Considerations**  
- Database queries use joins to minimize round trips
- Pagination implemented for large content lists
- Indexes provided for common query patterns
- File operations are non-blocking where possible

### **Error Recovery**
- Failed operations attempt to revert state changes
- Storage errors don't fail entire delete operations
- Retry logic includes exponential backoff
- All errors are logged for debugging

### **Ready for Phase 2?**
Once Phase 1 is complete, you can move to:
**[Phase 2 - Component Usage Guide](./content-pages-phase2-component-guide.md)**

Phase 1 provides the solid foundation that all UI components will depend on! 