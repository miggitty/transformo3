# Video Upload Project Type - Product Requirements Document

## Overview

This document outlines the requirements for adding a new project type system to the application, introducing **Video Upload** projects alongside the existing **Voice Recording** projects. This enhancement will allow users to create content by uploading videos instead of recording audio, with automatic video transcription and content generation.

## Project Architecture

### Current State
- Single project type: Audio recording at `/new`
- Audio processing → transcript → content generation workflow
- N8N webhooks for audio processing and content creation

### Target State
- Two project types: **Voice Recording** and **Video Upload**
- Unified content generation workflow for both types
- Project type differentiation throughout the application
- Enhanced navigation with dropdown menu system

## Core Requirements

### 1. Project Type System

#### Database Schema Changes
- Add `project_type` field to `content` table
- Values: `"voice_recording"` and `"video_upload"`
- Default to `"voice_recording"` for backward compatibility

#### Project Type Display
- Show project type in content tables (drafts, scheduled, etc.)
- Display project type on content details page
- Hide transcript section for video upload projects

### 2. Navigation & User Experience

#### Enhanced "New Content" System
- Convert "New Content" buttons to buttons with dropdown menus
- Button appearance: "New Content" text with down arrow icon on the right
- Click behavior: Opens menu with two options: "Voice Recording" and "Video Upload"
- Locations to update:
  - Sidebar navigation
  - Drafts page header
  - Any other "New Content" buttons throughout the app

#### URL Structure Changes
- **Current**: `/new` (audio recording)
- **New Structure**:
  - `/voice-recording` (replaces `/new`)
  - `/video-upload` (new page)

### 3. Voice Recording Project (Existing → Enhanced)

#### Page: `/voice-recording`
- **Components**: Reuse existing `AudioRecorder` component
- **Workflow**: Existing audio processing workflow
- **Project Type**: Set to `"voice_recording"`
- **Changes**: Minimal - just URL change and project type assignment

### 4. Video Upload Project (New)

#### Page: `/video-upload`
- **Components**: Reuse `VideoUploadModal` and `VideoUploadSection` components
- **File Storage**: Videos bucket with pattern `{businessId}_{contentId}_video_upload.{extension}`
- **Project Type**: Set to `"video_upload"`
- **Video Field**: Store URL in `content.video_long_url`

#### Video Upload Workflow
1. User uploads video → stored in Supabase videos bucket
2. Create content record with `project_type: "video_upload"`
3. Trigger video transcription via `N8N_WEBHOOK_VIDEO_TRANSCRIPTION`
4. N8N callback updates content with transcript and video script
5. Auto-trigger content creation workflow (`N8N_WEBHOOK_URL_CONTENT_CREATION`)
6. Navigate to drafts page

#### N8N Integration
- **Webhook**: `N8N_WEBHOOK_VIDEO_TRANSCRIPTION`
- **Payload**:
  ```json
  {
    "video_url": "https://supabase-url/storage/v1/object/public/videos/file.mp4",
    "content_id": "uuid",
    "business_id": "uuid",
    "project_type": "video_upload",
    "callbackUrl": "https://app-url/api/n8n/callback",
    "callbackSecret": "secret",
    "environment": "development"
  }
  ```

- **Expected Callback**:
  ```json
  {
    "content_id": "uuid",
    "transcript": "transcribed text...",
    "video_script": "generated script...",
    "content_title": "AI-generated title"
  }
  ```

### 5. Content Display Enhancements

#### Content Tables (Drafts, Scheduled, etc.)
- Add "Project Type" column
- Display: "Voice Recording" or "Video Upload"
- Maintain existing functionality

#### Content Details Page
- Display project type under headline
- **For Voice Recording**: Show all existing sections
- **For Video Upload**: Hide transcript section completely
- Maintain all other functionality

## Technical Implementation Plan

### Phase 1: Database & Core Infrastructure

#### Database Migration
- [ ] Create migration file: `YYYYMMDDHHMMSS_add-project-type-to-content.sql`
- [ ] Add `project_type TEXT DEFAULT 'voice_recording'` to content table
- [ ] Add CHECK constraint to ensure project_type IN ('voice_recording', 'video_upload')
- [ ] Add index on project_type for performance
- [ ] Test migration on development database
- [ ] Note: No existing data migration needed (new feature)

#### Type System Updates
- [ ] Update `types/supabase.ts` with new project_type field
- [ ] Add project type constants and types to `types/index.ts`
- [ ] Add project type enum: `type ProjectType = 'voice_recording' | 'video_upload'`
- [ ] Update `lib/content-status.ts` to handle both project types with unified "Processing" status
- [ ] Add database constraint to ensure project_type is only valid values

### Phase 2: Navigation & Routing

#### URL Changes
- [ ] Rename `app/(app)/new/` directory to `app/(app)/voice-recording/`
- [ ] Update all internal links from `/new` to `/voice-recording`
- [ ] Create new `app/(app)/video-upload/` directory and page
- [ ] Test all navigation flows

#### Button with Dropdown Navigation System
- [ ] Create `components/shared/new-content-button.tsx` component
- [ ] Component design: Button with "New Content" text + ChevronDown icon on right
- [ ] Update `components/shared/sidebar-nav.tsx` to use new button component
- [ ] Update drafts page header to use new button component
- [ ] Search and replace other "New Content" buttons throughout app

### Phase 3: Video Upload Implementation

#### Video Upload Page
- [ ] Create `app/(app)/video-upload/page.tsx`
- [ ] Create `app/(app)/video-upload/actions.ts` for server actions
- [ ] Implement video upload workflow using existing components
- [ ] Add project type assignment (`"video_upload"`)
- [ ] Integrate with N8N video transcription webhook
- [ ] Add file validation (400MB limit, MP4/WebM/MOV formats - same as existing)
- [ ] Navigate to drafts page after upload (matches current audio workflow)

#### Server Actions
- [ ] Create `createVideoUploadProject()` action
- [ ] Create `finalizeVideoUploadRecord()` action
- [ ] Handle video transcription webhook integration
- [ ] Implement auto-navigation to drafts after upload

#### N8N Callback Enhancement
- [ ] Update `app/api/n8n/callback/route.ts` to handle video transcription
- [ ] Add project type awareness to callback handling
- [ ] Implement auto-trigger of content creation for video projects
- [ ] Handle video transcription failure: set status to 'failed', enable retry button
- [ ] Handle content generation failure: set status to 'failed', enable retry button
- [ ] Test callback workflow end-to-end including failure scenarios

### Phase 4: Content Display Updates

#### Content Tables
- [ ] Update `components/shared/content-table.tsx` to show project type
- [ ] Update `components/shared/enhanced-content-table.tsx` with project type column
- [ ] Ensure project type displays correctly in all content views
- [ ] Test responsive design with new column

#### Content Details Page
- [ ] Update `components/shared/content-client-page.tsx` to show project type
- [ ] Implement conditional transcript hiding for video upload projects
- [ ] Ensure unified "Processing" status display for both audio and video
- [ ] Add retry functionality for failed video transcription (same as audio)
- [ ] Test all content detail page variations
- [ ] Ensure proper responsive design

### Phase 5: Testing & Polish

#### Integration Testing
- [ ] Test voice recording project creation end-to-end
- [ ] Test video upload project creation end-to-end
- [ ] Test N8N webhook integrations for both project types
- [ ] Test navigation between all project types and pages

#### UI/UX Testing
- [ ] Test "New Content" button with dropdown menu across all screen sizes
- [ ] Verify dropdown menu opens properly and shows both project type options
- [ ] Verify project type display consistency
- [ ] Test content tables with mixed project types
- [ ] Verify proper hiding of transcript for video projects

#### Error Handling
- [ ] Test error scenarios for video upload failures
- [ ] Test video transcription failure → status 'failed' → retry button functionality
- [ ] Test content generation failure → status 'failed' → retry button functionality  
- [ ] Test N8N webhook failure handling
- [ ] Ensure graceful degradation when webhooks are unavailable
- [ ] Test project type edge cases
- [ ] Verify file validation works (400MB limit, format restrictions)

### Phase 6: Documentation & Deployment

#### Documentation Updates
- [ ] Update README with new project type information
- [ ] Document N8N webhook setup for video transcription
- [ ] Create migration guide for existing users
- [ ] Update API documentation if applicable

#### Deployment Preparation
- [ ] Verify all environment variables are documented
- [ ] Test migration on staging environment
- [ ] Prepare rollback plan if needed
- [ ] Create deployment checklist

## Environment Variables Required

```bash
# Existing (already configured)
N8N_WEBHOOK_URL_AUDIO_PROCESSING=https://n8n-instance/webhook/audio-processing
N8N_WEBHOOK_URL_CONTENT_CREATION=https://n8n-instance/webhook/content-creation
N8N_CALLBACK_SECRET=your-secret-key
NEXT_PUBLIC_APP_URL=https://your-app-url

# New (already added to .env.local)
N8N_WEBHOOK_VIDEO_TRANSCRIPTION=https://n8n-instance/webhook/video-transcription
```

## Reusable Components

### Existing Components to Leverage
- `VideoUploadModal` - for video upload functionality
- `VideoUploadSection` - for video upload UI
- `AudioRecorder` - for voice recording (existing)
- `DropdownMenu` components - for new navigation
- `ContentTable` variants - for displaying project types
- All existing N8N webhook infrastructure

### New Components to Create
- `NewContentButton` - unified button with dropdown menu for project type selection
- Project type display badges/indicators
- Enhanced content table columns

## Success Criteria

### Functional Requirements
- [ ] Users can create Voice Recording projects at `/voice-recording`
- [ ] Users can create Video Upload projects at `/video-upload`
- [ ] All "New Content" buttons show dropdown menu with both options when clicked
- [ ] Project type displays correctly in all content tables
- [ ] Content details page shows project type and hides transcript for video uploads
- [ ] Video transcription workflow functions end-to-end
- [ ] Both project types generate content assets successfully

### Technical Requirements
- [ ] Database migration executes without errors
- [ ] All existing functionality remains intact
- [ ] N8N webhooks integrate properly with new project types
- [ ] Responsive design works across all screen sizes
- [ ] Performance remains acceptable with new features

### User Experience Requirements
- [ ] Navigation is intuitive and consistent
- [ ] Project type differentiation is clear throughout the app
- [ ] Upload workflows are smooth and provide proper feedback
- [ ] Error states are handled gracefully
- [ ] Loading states are appropriate and informative

## Risk Mitigation

### Technical Risks
- **Database Migration Issues**: Test thoroughly on development and staging
- **N8N Webhook Changes**: Maintain backward compatibility
- **Component Reuse Conflicts**: Verify existing video upload components work in new context

### User Experience Risks
- **Navigation Confusion**: Provide clear labeling and consistent patterns
- **Feature Discovery**: Ensure button with dropdown menu is intuitive (down arrow indicator)
- **Content Type Confusion**: Clear project type indicators throughout

### Business Risks
- **Workflow Disruption**: Maintain all existing functionality during transition
- **Data Integrity**: Ensure proper project type assignment for all content
- **Performance Impact**: Monitor system performance with new features

## Timeline Estimate

- **Phase 1-2**: 2-3 days (Database + Navigation)
- **Phase 3**: 3-4 days (Video Upload Implementation)
- **Phase 4**: 2-3 days (Content Display Updates)
- **Phase 5**: 2-3 days (Testing & Polish)
- **Phase 6**: 1-2 days (Documentation & Deployment)

**Total Estimated Time**: 10-15 days

## Notes

- Leverages existing video upload components from content details page
- Reuses proven N8N webhook infrastructure
- Maintains backward compatibility with existing voice recording projects
- Follows established patterns for database schema and component architecture
- Uses existing file naming conventions and storage patterns 