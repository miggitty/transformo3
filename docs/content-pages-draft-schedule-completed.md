# PRD: Content Management Pages - Draft, Schedule, Completed

**Version**: 1.0  
**Date**: December 30, 2024  
**Author**: AI Assistant  
**Priority**: High

---

## **1. Overview**

This document outlines the implementation of three distinct content management pages that replace the current single content page. The new system provides a clear content lifecycle workflow from draft → scheduled → completed, with appropriate UI/UX controls for each stage.

---

## **2. Goals & Objectives**

### **Primary Goals**
- **Clear Content Lifecycle**: Implement intuitive content status progression (processing → draft → scheduled → completed)
- **Status-Appropriate UI**: Provide appropriate editing capabilities based on content status
- **Enhanced User Experience**: Improve content management with modern table design and clear navigation
- **Robust Delete Functionality**: Implement comprehensive content deletion with proper cleanup

### **Secondary Goals**
- **Reuse Existing Architecture**: Leverage current components and patterns
- **Mobile-First Design**: Ensure responsive design across all devices
- **Real-time Updates**: Maintain existing real-time status updates

---

## **3. Current Architecture Analysis**

### **3.1 Existing Components to Reuse**
- ✅ `ContentTable` component (with modifications)
- ✅ Sidebar navigation structure (`SidebarNav`)
- ✅ Card-based page layouts (Business Settings/Integrations pattern)
- ✅ Real-time update system (`RealtimeContentUpdater`)
- ✅ Content assets scheduling system (`ContentAssetsManager`)
- ✅ Delete functionality patterns (from video deletion)

### **3.2 Current Status Flow**
```
Audio Upload → Processing → Completed
                    ↓
              Content Assets: Draft → Scheduled → Sent
```

### **3.3 New Status Flow**
```
Audio Upload → Processing → Draft → Scheduled → Partially Published → Completed
               (spinner)    (edit)   (view+edit)     (view+retry)      (view-only)
                  ↓
               Failed (retry button)

---

## **4. Feature Requirements**

### **4.1 Navigation Updates**
- **Remove**: "New Content" navigation item
- **Change**: "Content" → "Drafts" 
- **Add**: New "Content" section with four sub-items:
  - Drafts (`/content/drafts`) - includes failed content with retry buttons
  - Scheduled (`/content/scheduled`) 
  - Partially Published (`/content/partially-published`)
  - Completed (`/content/completed`)

### **4.2 Page Structure (All Pages)**
- **Layout**: Follow Business Settings/Integrations pattern
- **Header**: Clear page title (e.g., "Draft Content")
- **Content**: Modern table with hover effects
- **Responsive**: Mobile-first design

### **4.3 Table Features (All Pages)**

#### **Common Features**
- **Double-click**: Navigate to content details page
- **Hover effects**: Highlight rows on hover
- **Modern design**: Clean, professional appearance
- **Columns**: Title, Status, Created At, Actions

#### **Actions Column Variants**

| Page | Edit Icon | Delete Icon | Special Buttons | Behavior |
|------|-----------|-------------|-----------------|----------|
| **Drafts** | ✅ Edit | ✅ Delete | 🔄 Retry (failed content) | Full editing enabled |
| **Scheduled** | ✅ Edit | ✅ Delete | - | Edit in-place, auto-save |
| **Partially Published** | ✅ Edit | ✅ Delete | 🔄 Retry Failed | Edit unpublished assets only |
| **Completed** | ✅ View | ❌ None | - | View-only, no deletion |

**Important Notes:**
- Failed content appears in Drafts with retry button
- Users cannot navigate to content in "Processing" or "Failed" state from table
- All users can delete content (no permission restrictions)

### **4.4 Status-Based Content Detail Behavior**

#### **Draft Status** (Default Current Behavior)
- ✅ All edit buttons enabled
- ✅ Regenerate image buttons enabled
- ✅ Full content editing capabilities
- ✅ **Approval buttons required** - each content asset needs approval before scheduling
- ✅ Schedule button available (only when all assets approved)
- ✅ Retry button (for failed content only)

#### **Scheduled Status** (Updated Behavior)
- ✅ All edit buttons enabled (edit in-place)
- ✅ Regenerate image buttons enabled
- ✅ Changes auto-save to scheduled content
- ✅ Visual indicator: "✏️ EDITING SCHEDULED CONTENT - Scheduled for [date/time]"
- ✅ "Unschedule Content" button available

#### **Partially Published Status** (New Status)
- ✅ Edit buttons enabled for unpublished assets only
- ❌ Published assets are view-only
- ✅ "Retry Failed" button for failed assets
- ✅ Clear indicators showing which assets are published vs pending

#### **Failed/Processing Status** (Special Behavior)
- ❌ Users cannot navigate to this content from table
- ✅ Retry button available in table row
- ❌ No content detail page access until retry succeeds

#### **Completed Status** (View-Only)
- ❌ All edit buttons removed
- ❌ All regenerate buttons removed
- ❌ No schedule buttons
- ✅ View-only mode

---

## **5. Content Status Logic**

### **5.1 Status Determination Logic**

```typescript
function determineContentStatus(content: Content, assets: ContentAsset[]) {
  // Processing: Audio still being processed or content generation in progress
  if (content.status === 'processing' || content.content_generation_status === 'generating') {
    return 'processing';
  }
  
  // Failed: Content generation failed or has no assets
  if (content.content_generation_status === 'failed' || 
      (content.status === 'completed' && assets.length === 0)) {
    return 'failed'; // Shows in Drafts page with retry button
  }
  
  // Check asset statuses
  const scheduledAssets = assets.filter(asset => asset.asset_scheduled_at);
  const sentAssets = assets.filter(asset => asset.asset_status === 'Sent');
  const failedAssets = assets.filter(asset => asset.asset_status === 'Failed');
  
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

function canScheduleContent(assets: ContentAsset[]): boolean {
  // All assets must be approved before scheduling
  return assets.every(asset => asset.approved === true);
}
```

### **5.2 Scheduling States**

#### **Not Started**
- No assets have `asset_published_at`
- Allow full unscheduling and editing

#### **Partially Published**
- Some assets have `asset_status: 'Sent'`
- Allow unscheduling of remaining unpublished assets
- Show clear indicators of what's published vs pending

#### **Fully Published**
- All assets have `asset_status: 'Sent'`
- Content moves to "completed" status
- No further editing allowed

---

## **6. Delete Functionality**

### **6.1 Deletion Requirements**
When deleting content, the following must be removed **in order**:

1. **Images in Supabase Storage** (`images` bucket)
   - Pattern: `{content_id}_*` or `{business_id}_{content_id}_*`
2. **Videos in Supabase Storage** (`videos` bucket)
   - Pattern: `{content_id}_*` or `{business_id}_{content_id}_*`
3. **Audio in Supabase Storage** (`audio` bucket)
   - Pattern: `{content_id}_*` or `{business_id}_{content_id}_*`
4. **Content Assets** (`content_assets` table)
   - WHERE `content_id = {content_id}`
5. **Content Record** (`content` table)
   - WHERE `id = {content_id}`

### **6.2 Delete Confirmation Dialog**
```
⚠️ Warning: Delete Content

This action cannot be undone. Deleting this content will permanently remove:
• All generated content assets (blog posts, emails, social media content)
• All associated images, videos, and audio files
• All scheduling information

Are you sure you want to delete "{content_title}"?

[Cancel] [Delete Forever]
```

### **6.3 Delete Restrictions**
- **Scheduled Content**: Only allow deletion if no assets have been published yet
- **Completed Content**: No deletion allowed (remove delete button entirely)

---

## **7. Technical Implementation**

### **7.1 Database Schema Changes**

#### **Required Changes:**
```sql
-- Add approval field to content_assets table
ALTER TABLE content_assets 
ADD COLUMN approved BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX idx_content_assets_approved ON content_assets(approved);
```

#### **Existing Fields Used:**
- `content.status` (processing/completed)
- `content.content_generation_status` (generating/completed/failed/null)
- `content_assets.asset_scheduled_at` (scheduled date)
- `content_assets.asset_status` (Draft/Sent/Failed)
- `content_assets.asset_published_at` (publication timestamp)
- `content_assets.approved` (NEW - required for scheduling)

### **7.2 New Components**

#### **7.2.1 Enhanced ContentTable Component**
```typescript
interface ContentTableProps {
  serverContent: Tables<'content'>[];
  businessId: string;
  variant: 'drafts' | 'scheduled' | 'partially-published' | 'completed';
  onDelete?: (contentId: string) => Promise<void>;
  onRetry?: (contentId: string) => Promise<void>;
  showPagination?: boolean;
  pageSize?: 25 | 50 | 100;
}
```

#### **7.2.2 Content Delete Modal**
```typescript
interface ContentDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Tables<'content'>;
  onConfirm: () => Promise<void>;
}
```

#### **7.2.3 Status-Aware Content Detail Wrapper**
```typescript
interface ContentDetailWrapperProps {
  content: ContentWithBusiness;
  assets: ContentAsset[];
  mode: 'edit' | 'view' | 'scheduled' | 'partially-published';
  canSchedule: boolean; // Based on approval status
}
```

#### **7.2.4 Content Approval Component**
```typescript
interface ContentApprovalProps {
  asset: ContentAsset;
  onApprove: (assetId: string) => Promise<void>;
  disabled?: boolean;
}
```

#### **7.2.5 Retry Button Component**
```typescript
interface RetryButtonProps {
  contentId: string;
  onRetry: () => Promise<void>;
  variant: 'table' | 'detail';
  disabled?: boolean;
}
```

#### **7.2.6 Search and Filter Component**
```typescript
interface ContentFiltersProps {
  onSearch: (query: string) => void;
  onDateFilter: (startDate?: Date, endDate?: Date) => void;
  statusVariant: 'drafts' | 'scheduled' | 'partially-published' | 'completed';
}
```

### **7.3 Server Actions**

#### **7.3.1 Delete Content Action** (Hard Delete)
```typescript
export async function deleteContent({
  contentId,
  businessId,
}: {
  contentId: string;
  businessId: string;
}) {
  // 1. Delete images from storage (pattern: {content_id}_*)
  // 2. Delete videos from storage (pattern: {content_id}_*)
  // 3. Delete audio from storage (pattern: {content_id}_*)
  // 4. Delete content_assets records
  // 5. Delete content record
  // 6. Revalidate all content pages
}
```

#### **7.3.2 Unschedule Content Action**
```typescript
export async function unscheduleContent({
  contentId,
  type: 'all' | 'remaining',
}: {
  contentId: string;
  type: 'all' | 'remaining';
}) {
  // Reset asset_scheduled_at for appropriate assets
  // 'remaining' only unschedules assets not yet published
}
```

#### **7.3.3 Approve Content Asset Action**
```typescript
export async function approveContentAsset({
  assetId,
}: {
  assetId: string;
}) {
  // Set approved = true for the asset
  // Check if all assets approved for content
  // Enable scheduling if all approved
}
```

#### **7.3.4 Retry Content Processing Action**
```typescript
export async function retryContentProcessing({
  contentId,
}: {
  contentId: string;
}) {
  // Reset content_generation_status to 'generating'
  // Trigger N8N content creation workflow
  // Return to processing state
}
```

#### **7.3.5 Search and Filter Content Action**
```typescript
export async function getFilteredContent({
  businessId,
  status,
  searchQuery,
  page,
  pageSize,
  startDate,
  endDate,
}: {
  businessId: string;
  status: 'drafts' | 'scheduled' | 'partially-published' | 'completed';
  searchQuery?: string;
  page: number;
  pageSize: 25 | 50 | 100;
  startDate?: Date;
  endDate?: Date;
}) {
  // Return paginated, filtered content
}
```

### **7.4 Route Structure**
```
app/(app)/content/
├── drafts/
│   └── page.tsx (includes failed content with retry)
├── scheduled/
│   └── page.tsx (edit in-place functionality)
├── partially-published/
│   └── page.tsx (mixed published/unpublished assets)
├── completed/
│   └── page.tsx (view-only)
├── [id]/
│   ├── page.tsx (enhanced with status logic & approval)
│   └── actions.ts (delete, retry, approve, unschedule)
└── page.tsx (redirect to /content/drafts)
```

---

## **8. User Experience Flows**

### **8.1 Content Creation Flow**
```
1. User uploads audio → Status: "Processing"
2. N8N processes → Status: "Draft" (or "Failed" with retry button)
3. User reviews/edits content
4. User approves each content asset (required step)
5. User schedules content → Status: "Scheduled" (only when all approved)
6. N8N publishes assets → Status: "Partially Published" (some sent)
7. All assets published → Status: "Completed"
```

### **8.2 Editing Scheduled Content**
```
1. User clicks scheduled content
2. Content detail page opens in edit mode
3. Visual indicator shows "✏️ EDITING SCHEDULED CONTENT"
4. User makes changes
5. Changes auto-save to scheduled content
6. Content remains scheduled (no unscheduling needed)
7. Optional: "Unschedule Content" button available if needed
```

### **8.3 Partial Publishing Scenario**
```
1. Content scheduled for 5 days
2. Day 1-2: Some assets published (status: Sent)
3. Content moves to "Partially Published" page
4. User can edit unpublished assets only
5. Published assets show as view-only
6. "Retry Failed" button available for any failed assets
7. User can reschedule remaining unpublished assets
```

### **8.4 Failed Content Recovery**
```
1. N8N workflow fails during processing/publishing
2. Content appears in "Drafts" with "Failed" status
3. User sees retry button in table row
4. User cannot click into content detail (disabled)
5. User clicks retry → triggers N8N workflow again
6. Content returns to "Processing" status
7. On success → moves to "Draft" for review/approval
```

### **8.5 Approval Workflow**
```
1. Content in "Draft" status with generated assets
2. Each asset shows "Approve" button
3. User reviews each asset (blog, email, social posts)
4. User clicks "Approve" on each satisfactory asset
5. Schedule button only enables when ALL assets approved
6. User can edit and re-approve if changes needed
7. Once scheduled, approval status maintained
```

---

## **9. Implementation Guides & Code Examples**

For detailed technical implementation guidance, refer to these companion documents:

### **9.1 Core Implementation Guides**
- **[PHASE 1 - Server Actions & Database Guide](./content-pages-phase1-server-actions-guide.md)** - Complete server action implementations with error handling, database queries, and optimization patterns
- **[PHASE 2 - Component Usage Guide](./content-pages-phase2-component-guide.md)** - Enhanced ContentTable usage, component wiring, and UI patterns  
- **[PHASE 3 - Error Handling & Real-time Guide](./content-pages-phase3-error-realtime-guide.md)** - Error boundaries, retry logic, and real-time update patterns for the 4-status system

### **9.2 Quick Reference**
```typescript
// Status determination - see Server Actions Guide for full implementation
const status = determineContentStatus(content, assets);
const canSchedule = canScheduleContent(assets);

// Enhanced table usage - see Component Guide for complete examples
<ContentTable 
  variant="drafts" 
  onDelete={handleDelete} 
  onRetry={handleRetry}
  showPagination={true}
  pageSize={50}
/>

// Error handling - see Error Handling Guide for patterns
<ErrorBoundary fallback={ContentErrorFallback}>
  <ContentTable serverContent={content} businessId={businessId} />
</ErrorBoundary>
```

### **9.3 Implementation Priority**
1. **Start with PHASE 1 (Server Actions Guide)** - Core business logic and database patterns
2. **Follow PHASE 2 (Component Guide)** - UI implementation and integration  
3. **Add PHASE 3 (Error Handling Guide)** - Robust error handling and real-time features

---

## **10. Implementation Checklist**

### **Phase 1: Database & Navigation Setup** 
- [ ] **Database schema updates**
  - [ ] Add `approved` boolean field to `content_assets` table
  - [ ] Create index on `approved` field for performance
  - [ ] Test migration on development database
- [ ] **Update sidebar navigation structure**
  - [ ] Add "Content" section with four sub-items (Drafts, Scheduled, Partially Published, Completed)
  - [ ] Remove "New Content" from main navigation
  - [ ] Update navigation icons and active states
- [ ] **Create base page components**
  - [ ] `/content/drafts/page.tsx` (includes failed content)
  - [ ] `/content/scheduled/page.tsx`
  - [ ] `/content/partially-published/page.tsx` (new)
  - [ ] `/content/completed/page.tsx`
  - [ ] `/content/page.tsx` (redirect to drafts)
- [ ] **Implement enhanced status determination logic**
  - [ ] Create `determineContentStatus()` function with all statuses
  - [ ] Create `canScheduleContent()` approval validation function
  - [ ] Update content queries to include asset status and approval

### **Phase 2: Enhanced Table Component & Performance Features**
- [ ] **Enhance `ContentTable` component**
  - [ ] Add variant prop (drafts/scheduled/partially-published/completed)
  - [ ] Add action buttons (edit/view, delete, retry)
  - [ ] Implement hover effects and modern styling
  - [ ] Add double-click navigation (disabled for processing/failed content)
  - [ ] Prevent navigation to processing/failed content
- [ ] **Implement pagination system**
  - [ ] Add pagination controls (25/50/100 items per page)
  - [ ] Implement infinite scroll or pagination UI (choose based on performance)
  - [ ] Add page size selector
- [ ] **Add search and filtering**
  - [ ] Search by content title
  - [ ] Date range filtering (created_at)
  - [ ] Real-time search with debouncing
- [ ] **Create action button components**
  - [ ] Edit/View icon button with status-aware behavior
  - [ ] Delete icon button with restrictions
  - [ ] Retry icon button for failed content
  - [ ] Implement proper tooltips and disabled states

### **Phase 3: Delete & Retry Functionality**
- [ ] **Implement hard delete system**
  - [ ] Create `deleteContent` server action
  - [ ] Implement storage file cleanup by content ID pattern
    - [ ] Delete images from `images` bucket (`{content_id}_*`)
    - [ ] Delete videos from `videos` bucket (`{content_id}_*`)
    - [ ] Delete audio from `audio` bucket (`{content_id}_*`)
  - [ ] Delete content_assets records
  - [ ] Delete content record (last step)
  - [ ] Create delete confirmation modal with clear warning
  - [ ] Add proper error handling (no rollback needed for hard delete)
- [ ] **Implement retry functionality**
  - [ ] Create `retryContentProcessing` server action
  - [ ] Trigger N8N content creation workflow
  - [ ] Update content status to 'processing'
  - [ ] Add retry button in table rows
  - [ ] Handle retry failures gracefully
- [ ] **Add delete restrictions**
  - [ ] Allow deletion for all users (no permission restrictions)
  - [ ] Remove delete button from completed content
  - [ ] Show appropriate error messages for edge cases

### **Phase 4: Content Detail Status Logic & Approval System**
- [ ] **Implement approval workflow**
  - [ ] Create `approveContentAsset` server action
  - [ ] Add approval buttons to each content asset
  - [ ] Implement approval status tracking
  - [ ] Disable scheduling until all assets approved
  - [ ] Visual indicators for approved vs unapproved assets
- [ ] **Enhance content detail page with status awareness**
  - [ ] Implement status-aware UI rendering for all 4 statuses
  - [ ] Add visual indicator for editing scheduled content
  - [ ] Enable edit-in-place for scheduled content (auto-save)
  - [ ] Add "Unschedule Content" button (optional)
  - [ ] Implement view-only mode for completed content
  - [ ] Show mixed edit/view for partially published content
- [ ] **Create unschedule functionality**
  - [ ] Implement `unscheduleContent` server action
  - [ ] Handle partial unscheduling logic (remaining assets only)
  - [ ] Update UI after unscheduling operations

### **Phase 5: Status Transitions & Edge Cases**
- [ ] **Implement automatic status transitions**
  - [ ] Processing → Draft (when content generation completes successfully)
  - [ ] Processing → Failed (when content generation fails)
  - [ ] Scheduled → Partially Published (when some assets are sent)
  - [ ] Partially Published → Completed (when all remaining assets are sent)
  - [ ] Failed → Processing (when retry is triggered)
- [ ] **Handle edge cases**
  - [ ] Content with no assets → Failed status with retry button
  - [ ] Failed content generation → Failed status, no detail page access
  - [ ] Partially failed publishing → Show in Partially Published with retry options
  - [ ] N8N workflow failures → Proper error handling and status updates
- [ ] **Implement real-time status monitoring**
  - [ ] Batched updates every 5-10 seconds (pessimistic approach)
  - [ ] Update status across all relevant pages
  - [ ] Handle concurrent user sessions

### **Phase 6: Polish & Testing**
- [ ] **Implement real-time status updates**
  - [ ] Update RealtimeContentUpdater for new 4-status logic
  - [ ] Implement batched updates (5-10 second intervals)
  - [ ] Test status changes across all four pages
  - [ ] No notification popups (per user preference)
- [ ] **Responsive design testing**
  - [ ] Test all four pages on mobile/tablet/desktop
  - [ ] Verify table responsiveness and hover effects
  - [ ] Test pagination and search on mobile devices
  - [ ] Verify action buttons work on touch devices
- [ ] **User experience polish**
  - [ ] Add loading states for all async operations (pessimistic updates)
  - [ ] Implement proper error boundaries
  - [ ] Add success/error toast messages
  - [ ] Visual indicators for approved/unapproved content
  - [ ] Clear status badges and progress indicators

### **Phase 7: Final Implementation & Documentation**
- [ ] **Development environment setup**
  - [ ] Reset development database (no migration needed)
  - [ ] Test with fresh content data
  - [ ] Verify all status transitions work correctly
- [ ] **User documentation**
  - [ ] Update help text and tooltips
  - [ ] Create user guide for approval workflow
  - [ ] Document retry functionality for failed content
- [ ] **Performance optimization**
  - [ ] Optimize database queries for status filtering
  - [ ] Implement proper pagination queries
  - [ ] Test performance with large content sets (1000+ items)
  - [ ] Implement query caching for improved response times

---

## **11. Risk Assessment**

### **11.1 Technical Risks**
- **Low Risk**: Reusing existing components and patterns
- **Medium Risk**: Complex status determination logic
- **Low Risk**: Database changes (none required)

### **11.2 User Experience Risks**
- **Low Risk**: Clear navigation structure
- **Medium Risk**: User adaptation to three-page workflow
- **Low Risk**: Existing users familiar with similar patterns

### **11.3 Data Integrity Risks**
- **Medium Risk**: Comprehensive delete functionality
- **Low Risk**: Status logic based on existing data
- **Mitigation**: Implement proper error handling and rollback mechanisms

---

## **12. Success Metrics**

### **12.1 User Engagement**
- Users successfully navigate between content states
- Reduced time to find content in specific status
- Increased user satisfaction with content management

### **12.2 Technical Performance**
- All pages load within 2 seconds
- Real-time updates work reliably
- No data loss during delete operations

### **12.3 Business Value**
- Clearer content workflow improves productivity
- Better content organization reduces user confusion
- Comprehensive delete functionality reduces storage costs

---

## **13. Future Enhancements**

### **13.1 Potential Features**
- Bulk operations (bulk delete, bulk schedule)
- Content filtering and search
- Content templates and duplication
- Advanced scheduling options (recurring content)

### **13.2 Integration Opportunities**
- Integration with existing calendar view
- Enhanced analytics for content performance
- Workflow automation based on content status

---

## **14. Key Decisions & Specifications**

### **14.1 Content Status System**
- **Four Primary Statuses**: Drafts, Scheduled, Partially Published, Completed
- **Failed Content**: Appears in Drafts with retry functionality
- **Processing Content**: Users cannot access detail page until complete

### **14.2 Approval Workflow (Critical)**
- **Required**: All content assets must be approved before scheduling
- **Database**: New `approved` boolean field in `content_assets` table
- **UI**: Approval buttons on each asset in content detail page
- **Validation**: Schedule button disabled until all assets approved

### **14.3 Edit-in-Place for Scheduled Content**
- **Approach**: Direct editing with auto-save (no unscheduling required)
- **Visual Indicator**: "✏️ EDITING SCHEDULED CONTENT" message
- **Pessimistic Updates**: Wait for server confirmation before showing changes

### **14.4 Performance & Scale Features**
- **Pagination**: 25/50/100 items per page with infinite scroll option
- **Search**: Real-time search by content title with debouncing
- **Filtering**: Date range filtering by creation date
- **Updates**: Batched real-time updates every 5-10 seconds

### **14.5 Delete & Retry Strategy**
- **Hard Deletes**: Immediate permanent deletion (no trash/recovery)
- **Storage Cleanup**: Delete files by content ID pattern (`{content_id}_*`)
- **Retry**: Failed content gets retry button to re-trigger N8N workflows
- **Permissions**: All users can delete (no restrictions)

---

**Implementation Timeline**: 3-4 weeks (expanded scope)  
**Dependencies**: None (builds on existing architecture)  
**Database Changes**: Single field addition (`content_assets.approved`)  
**Critical Path**: Approval workflow must be implemented before scheduling features

---

*This PRD provides a comprehensive roadmap for implementing the four-page content management system with approval workflow, retry functionality, and performance optimizations while leveraging existing architecture and maintaining high code quality standards.* 