# Video Uploading Feature - Product Requirements Document

## Overview

This document outlines the requirements for implementing video upload functionality on the content details page, allowing users to upload and manage long and short social media videos.

## Feature Summary

Users will be able to upload, view, and manage two types of videos for each content item:
- **Long Video** (`video_long_url`)
- **Short Video** (`video_short_url`)

The videos will be stored in Supabase Storage and embedded directly in the content details page for playback.

## User Stories

### Primary User Stories

1. **As a user**, I want to upload a long social media video so that it can be associated with my content
2. **As a user**, I want to upload a short social media video so that it can be associated with my content
3. **As a user**, I want to view uploaded videos directly on the content details page
4. **As a user**, I want to replace existing videos with new ones
5. **As a user**, I want to delete existing videos when they're no longer needed

### Secondary User Stories

1. **As a user**, I want to see upload progress so I know the upload is working
2. **As a user**, I want to receive clear error messages if uploads fail
3. **As a user**, I want confirmation before deleting videos to prevent accidents

## Technical Requirements

### File Specifications

- **Supported Formats**: MP4 (recommended), WebM, MOV
- **Maximum File Size**: 400MB per video
- **Storage Location**: Supabase Storage `videos` bucket (flat structure)
- **File Naming Convention**: 
  - Long videos: `[content_id]_long_video.[extension]`
  - Short videos: `[content_id]_short_video.[extension]`

### Database Schema

The feature utilizes existing fields in the `content` table:
- `video_long_url` (text) - URL to the long video in Supabase Storage
- `video_short_url` (text) - URL to the short video in Supabase Storage

### User Interface Requirements

#### Page Layout

The video upload section will be positioned:
- **Location**: Top of content details page, directly above the existing content assets section
- **Structure**: Two separate upload areas (Long Video and Short Video)

#### Video Upload States

**State 1: No Video Uploaded**
- Display upload button with label "Upload Long Video" / "Upload Short Video"
- Click opens upload modal/popup

**State 2: Video Uploaded**
- Display embedded video player (click-to-play, no thumbnail)
- Show "Upload New Video" button below the video
- Show "Delete Video" button below the video

#### Upload Modal/Popup

- **Trigger**: Clicking upload button
- **Content**: 
  - File drag & drop area
  - File browser button
  - Upload progress bar/indicator
  - Cancel button
  - Upload confirmation
- **Validation**: Real-time file format and size validation
- **Behavior**: Modal closes after successful upload

#### Video Player

- **Type**: Native HTML5 video player
- **Behavior**: Click-to-play (no autoplay)
- **Controls**: Standard video controls (play, pause, seek, volume, fullscreen)
- **Thumbnail**: None (black screen until play is clicked)

### Functional Requirements

#### Upload Process

1. User clicks upload button
2. Upload modal opens
3. User selects video file (drag & drop or file browser)
4. Client-side validation (format, size)
5. Upload progress indicator displays
6. File uploads to Supabase Storage
7. Database record updates with storage URL
8. Page refreshes/updates to show new video
9. Modal closes

#### Upload Constraints

- **Concurrent Uploads**: One video upload at a time (prevent simultaneous long + short uploads)
- **File Replacement**: New uploads overwrite existing files with same naming convention
- **Database Updates**: URL field updates atomically with successful upload

#### Delete Process

1. User clicks delete button
2. Confirmation dialog appears: "Are you sure you want to delete this video? This action cannot be undone."
3. If confirmed:
   - File deleted from Supabase Storage
   - Database URL field set to null
   - UI updates to show "no video" state

### Error Handling

#### Client-Side Validation Errors

- **Invalid Format**: "Please select a valid video file (MP4, WebM, or MOV)"
- **File Too Large**: "File size must be under 400MB. Please select a smaller file."
- **No File Selected**: "Please select a video file to upload"

#### Upload Errors

- **Network Issues**: "Upload failed due to connection issues. Please try again."
- **Storage Errors**: "Unable to save video. Please try again."
- **Database Errors**: "Video uploaded but failed to save. Please contact support."
- **Generic Errors**: "Upload failed. Please try again or contact support if the problem persists."

#### Retry Mechanism

- Automatic retry for network-related failures (up to 3 attempts)
- Manual retry option for all failed uploads
- Clear error messaging with suggested next steps

### Performance Requirements

- **Upload Progress**: Real-time progress indication with percentage
- **File Processing**: No server-side processing (store as-is)
- **Page Loading**: Existing videos load without impacting page performance
- **Mobile Compatibility**: Functional upload experience on mobile devices

### Security & Permissions

- **User Access**: All authenticated users can upload, view, and delete videos
- **Content Ownership**: Users can manage videos for any content (no ownership restrictions)
- **File Validation**: Server-side format and size validation
- **Storage Security**: Use Supabase RLS policies for storage access

## Implementation Phases

### Phase 1: Core Upload Functionality
- Basic upload UI components
- File validation and upload to Supabase Storage
- Database integration
- Video display and playback

### Phase 2: Enhanced UX
- Upload progress indicators
- Error handling and user feedback
- Delete functionality with confirmations
- Mobile optimization

### Phase 3: Polish & Testing
- Comprehensive error handling
- Performance optimization
- Cross-browser testing
- Mobile device testing

## Success Criteria

- Users can successfully upload videos up to 400MB
- Upload process completes within reasonable time (< 2 minutes for 400MB)
- Videos play correctly in all supported browsers
- Error messages are clear and actionable
- Mobile upload experience is functional
- No data loss during upload/delete operations

## Technical Dependencies

- Supabase Storage (videos bucket)
- Supabase JavaScript client
- HTML5 video player support
- File API support (drag & drop)
- Modern browser compatibility

## Constraints & Limitations

- Single video upload at a time
- No video processing or compression
- No thumbnail generation
- No video preview before upload
- Flat storage structure (no folders)
- 400MB file size limit (Supabase Storage limitation)

---

**Document Version**: 1.0  
**Last Updated**: [Current Date]  
**Author**: AI Assistant  
**Review Status**: Draft 