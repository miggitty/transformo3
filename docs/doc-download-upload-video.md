# PRD: Video Download & Upload Functionality

## 📋 Overview

This document outlines the implementation of video download and upload functionality for the content details page. Users will be able to download existing videos and upload new videos to replace existing ones for both social long videos and social short videos.

**Integration with Existing Systems:**
- ✅ **Leverages existing video upload infrastructure** (`VideoUploadModal`, `VideoUploadSection`, `updateVideoUrl`)
- ✅ **Follows existing content video naming pattern** (`{businessId}_{contentId}_{videoType}.{extension}`)
- ✅ **Integrates with existing database schema** (`content` table - `video_long_url`, `video_short_url`)
- ✅ **Uses existing Supabase storage infrastructure** (`videos` bucket with RLS policies)
- ✅ **Replicates image hover UI pattern** (hover overlay buttons)

## 🎯 Goals

1. **Download Functionality**: Allow users to download videos from content directly to their computer
2. **Upload Functionality**: Allow users to upload new videos to replace existing ones
3. **Seamless Integration**: Integrate with existing video display UI without disrupting current workflows
4. **Consistent UX**: Follow existing patterns for both video uploads and image hover interactions
5. **Simple Implementation**: Reuse existing upload infrastructure and storage patterns

## 🏗️ Technical Architecture

### **Existing Components to Leverage**

#### **1. Video Upload Infrastructure**
- **Component**: `VideoUploadModal` (`components/shared/video-upload-modal.tsx`)
- **Server Action**: `updateVideoUrl` (`app/(app)/content/[id]/actions.ts`)
- **Storage**: Supabase `videos` bucket with existing RLS policies
- **File Naming**: `{businessId}_{contentId}_{videoType}.{extension}`

#### **2. Video Display Components**
- **Location**: Social Long Video and Social Short Video sections in `ContentClientPage`
- **Current State**: Shows HTML5 video player with controls
- **Enhancement**: Add hover overlay with download and upload buttons

#### **3. Database Schema (Existing)**
```sql
-- content table (already exists)
content {
  id uuid PRIMARY KEY,
  business_id uuid,
  video_long_url text,    -- URL to long video in Supabase Storage
  video_short_url text,   -- URL to short video in Supabase Storage
  content_title text,     -- Used for download filename
  -- ... other existing fields
}
```

#### **4. Storage Pattern (Existing)**
- **Bucket**: `videos` (already exists with RLS policies)
- **Naming**: `{businessId}_{contentId}_{videoType}.{extension}`
- **Examples**: 
  - `f3d2c8b1-7e92-4a33-8f1e-2b5c9a8d7e6f_a1b2c3d4-5e6f-7890-abcd-ef1234567890_long.mp4`
  - `f3d2c8b1-7e92-4a33-8f1e-2b5c9a8d7e6f_a1b2c3d4-5e6f-7890-abcd-ef1234567890_short.webm`

### **Video Types Supported**
- **Social Long Video** - `content.video_long_url`
- **Social Short Video** - `content.video_short_url`

## 🎨 User Experience Flow

### **Enhanced Video Player UI**
When user hovers over any video in the social long video or social short video sections:

```
[Download] [Upload]
```

**Visual Layout:**
- **Download Icon**: ⬇️ (Download arrow)
- **Upload Icon**: ⬆️ (Upload arrow)
- **Positioning**: Top-right corner of video player, overlay style
- **Spacing**: 8px between buttons
- **Styling**: Semi-transparent background, white icons, shadow for visibility

### **Download Flow**
1. User hovers over video player
2. User clicks download button (⬇️)
3. Browser downloads video from `content.video_long_url` or `content.video_short_url`
4. File saves as: `{content_title}_social_long_video_{timestamp}.{extension}` or `{content_title}_social_short_video_{timestamp}.{extension}`
   - Example: `My_Content_Title_social_long_video_2024-01-15.mp4`

### **Upload Flow**
1. User hovers over video player
2. User clicks upload button (⬆️)
3. **Reuse existing `VideoUploadModal`** opens
4. User selects video file (drag & drop or file browser)
5. **Existing file validation** (format, size) and **progress tracking**
6. File uploads to Supabase Storage using **existing TUS upload logic**
7. **Existing server action** updates `content.video_long_url` or `content.video_short_url`
8. UI updates with new video immediately
9. Modal closes

## 🔧 Implementation Plan

### **Phase 1: Create Video Hover Component**

#### **1.1 Create VideoWithUploadDownload Component**
**File**: `components/shared/video-with-upload-download.tsx`

```typescript
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2 } from 'lucide-react';
import { ContentWithBusiness } from '@/types';
import { VideoUploadModal } from './video-upload-modal';
import { toast } from 'sonner';

interface VideoWithUploadDownloadProps {
  content: ContentWithBusiness;
  videoType: 'long' | 'short';
  children: React.ReactNode;
  className?: string;
  onVideoUpdated?: (videoType: 'long' | 'short', videoUrl: string) => void;
}

export default function VideoWithUploadDownload({
  content,
  videoType,
  children,
  className = '',
  onVideoUpdated,
}: VideoWithUploadDownloadProps) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const videoUrl = videoType === 'long' ? content.video_long_url : content.video_short_url;
  const hasVideo = !!videoUrl;

  if (!hasVideo) {
    return <div className={className}>{children}</div>;
  }

  const handleDownload = async () => {
    if (!videoUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Generate filename using content title pattern
      const timestamp = new Date().toISOString().split('T')[0];
      const urlWithoutQuery = videoUrl.split('?')[0];
      const extension = urlWithoutQuery.split('.').pop() || 'mp4';
      const sanitizedTitle = (content.content_title || 'Video')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      
      a.download = `${sanitizedTitle}_social_${videoType}_video_${timestamp}.${extension}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Video downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download video');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpload = () => {
    if (!content.business_id) {
      toast.error('Business ID is required to upload videos.');
      return;
    }
    setIsUploadModalOpen(true);
  };

  const handleVideoUploaded = (uploadedVideoType: 'long' | 'short', videoUrl: string) => {
    if (onVideoUpdated) {
      onVideoUpdated(uploadedVideoType, videoUrl);
    }
    setIsUploadModalOpen(false);
  };

  return (
    <div className={`relative group ${className}`}>
      {children}
      
      {/* Button Group - appears on hover */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2">
        
        {/* Download Button */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
          onClick={handleDownload}
          disabled={isDownloading}
          aria-label="Download video"
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
        
        {/* Upload Button */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg hover:shadow-xl hover:scale-105"
          onClick={handleUpload}
          aria-label="Upload new video"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </div>

      {/* Video Upload Modal - Reuse existing component */}
      {content.business_id && (
        <VideoUploadModal
          open={isUploadModalOpen}
          onOpenChange={setIsUploadModalOpen}
          videoType={videoType}
          contentId={content.id}
          businessId={content.business_id}
          onVideoUploaded={handleVideoUploaded}
        />
      )}
    </div>
  );
}
```

### **Phase 2: Integrate with Content Client Page**

#### **2.1 Update ContentClientPage Component**
**File**: `components/shared/content-client-page.tsx`

**Update the Social Long Video section** (around line 847):
```typescript
// Replace existing video display code
{(content.video_long_url || socialAsset.image_url) && (
  <div className="relative">
    {content.video_long_url ? (
      <VideoWithUploadDownload
        content={content}
        videoType="long"
        onVideoUpdated={handleVideoUpdate}
      >
        <video 
          src={content.video_long_url ?? undefined}
          className="w-full object-cover"
          controls
          poster={getImageUrl(socialAsset.image_url)}
        />
      </VideoWithUploadDownload>
    ) : (
      <ImageWithRegeneration 
        contentAsset={socialAsset}
        className="block w-full"
        onImageUpdated={handleImageUpdated}
        enableDownload={true}
        enableUpload={true}
        enableRegeneration={true}
      >
        <img 
          src={getImageUrl(socialAsset.image_url)} 
          alt="Social post content"
          className="w-full object-cover"
        />
      </ImageWithRegeneration>
    )}
  </div>
)}
```

**Update the Social Short Video section** (around line 965):
```typescript
// Replace existing video display code
{(content.video_short_url || socialAsset.image_url) && (
  <div className="relative">
    {content.video_short_url ? (
      <VideoWithUploadDownload
        content={content}
        videoType="short"
        onVideoUpdated={handleVideoUpdate}
      >
        <video 
          src={content.video_short_url ?? undefined}
          className="w-full object-cover"
          controls
          poster={getImageUrl(socialAsset.image_url)}
        />
      </VideoWithUploadDownload>
    ) : (
      <ImageWithRegeneration 
        contentAsset={socialAsset}
        className="block w-full"
        onImageUpdated={handleImageUpdated}
        enableDownload={true}
        enableUpload={true}
        enableRegeneration={true}
      >
        <img 
          src={getImageUrl(socialAsset.image_url)} 
          alt="Social post content"
          className="w-full object-cover"
        />
      </ImageWithRegeneration>
    )}
  </div>
)}
```

#### **2.2 Import New Component**
Add to imports in `content-client-page.tsx`:
```typescript
import VideoWithUploadDownload from '@/components/shared/video-with-upload-download';
```

### **Phase 3: Download Process Implementation**

#### **3.1 Download Handler Logic**
The download functionality is implemented in the `VideoWithUploadDownload` component:

```typescript
const handleDownload = async () => {
  // 1. Fetch video from Supabase storage URL
  const response = await fetch(videoUrl);
  const blob = await response.blob();
  
  // 2. Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // 3. Generate filename using content title pattern
  const timestamp = new Date().toISOString().split('T')[0];
  const extension = videoUrl.split('.').pop() || 'mp4';
  const sanitizedTitle = (content.content_title || 'Video')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  a.download = `${sanitizedTitle}_social_${videoType}_video_${timestamp}.${extension}`;
  
  // 4. Trigger download
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
```

### **Phase 4: Upload Process Integration**

#### **4.1 Reuse Existing Upload Infrastructure**
The upload functionality leverages the existing `VideoUploadModal` component:

- **Modal Component**: Uses existing `VideoUploadModal` with all existing features
- **File Validation**: Existing validation (MP4, WebM, MOV, max 400MB)
- **Progress Tracking**: Existing TUS upload with progress indicators
- **Server Action**: Uses existing `updateVideoUrl` server action
- **Storage**: Uses existing Supabase videos bucket with RLS policies

#### **4.2 Upload Handler Logic**
```typescript
const handleUpload = () => {
  // 1. Validate business ID exists
  if (!content.business_id) {
    toast.error('Business ID is required to upload videos.');
    return;
  }
  
  // 2. Open existing VideoUploadModal
  setIsUploadModalOpen(true);
};

const handleVideoUploaded = (uploadedVideoType: 'long' | 'short', videoUrl: string) => {
  // 3. Update parent component state
  if (onVideoUpdated) {
    onVideoUpdated(uploadedVideoType, videoUrl);
  }
  
  // 4. Close modal
  setIsUploadModalOpen(false);
};
```

## 🧪 Testing Checklist

### **Download Functionality**
- [ ] Download works for both long and short videos
- [ ] Download works for all supported video formats (MP4, WebM, MOV)
- [ ] Downloaded filename follows naming convention: `{content_title}_social_{videoType}_video_{timestamp}.{extension}`
- [ ] Download works with both local and production Supabase URLs
- [ ] Error handling for network failures
- [ ] Download button only appears when video exists
- [ ] Loading state shows during download
- [ ] Toast notifications appear for success/error

### **Upload Functionality**
- [ ] Upload modal opens when upload button is clicked
- [ ] All existing file validation works (format, size)
- [ ] Upload progress indicator functions correctly
- [ ] File uploads to correct storage location
- [ ] Database updates correctly with new video URL
- [ ] UI refreshes with new video immediately
- [ ] Modal closes after successful upload
- [ ] Error handling for upload failures
- [ ] Toast notifications appear for all actions

### **UI/UX Testing**
- [ ] Hover state shows both download and upload buttons
- [ ] Button positioning and spacing looks correct
- [ ] Icons are clear and recognizable
- [ ] Loading states work properly for both buttons
- [ ] Responsive design works on mobile devices
- [ ] Hover functionality works on touch devices
- [ ] Video player controls don't interfere with hover buttons

### **Integration Testing**
- [ ] Upload doesn't interfere with existing video playback
- [ ] Download doesn't interfere with other functionality
- [ ] Works for both social long video and social short video
- [ ] Works in both local and production environments
- [ ] Supabase storage integration works correctly
- [ ] RLS policies are respected

### **Error Handling Testing**
- [ ] Invalid video URLs handle gracefully
- [ ] Network failures show appropriate error messages
- [ ] Missing business ID shows appropriate error
- [ ] Large file uploads handle correctly
- [ ] Unsupported file formats handle correctly

## 📁 Files to Create/Modify

### **New Files**
- [ ] `components/shared/video-with-upload-download.tsx` - Main component for video hover functionality

### **Modified Files**
- [ ] `components/shared/content-client-page.tsx` - Integrate new video hover component
- [ ] `types/index.ts` - Add new prop types if needed (optional)

### **Existing Files to Leverage (No Changes)**
- ✅ `components/shared/video-upload-modal.tsx` - Reuse existing modal
- ✅ `app/(app)/content/[id]/actions.ts` - Reuse existing `updateVideoUrl` server action
- ✅ Supabase storage configuration - Already handles video uploads
- ✅ Existing RLS policies - Already secure video storage

## 🎯 Success Metrics

### **Functional Requirements**
- [ ] Users can download videos from both social long and short video sections
- [ ] Users can upload new videos to replace existing ones
- [ ] All existing video upload functionality continues to work
- [ ] Download filenames follow the specified naming convention
- [ ] Upload progress and error handling work identically to existing functionality

### **Technical Requirements**
- [ ] No new API endpoints required (leverage existing infrastructure)
- [ ] No database schema changes required
- [ ] No new storage buckets or policies required
- [ ] Component reuses existing video upload logic
- [ ] Performance remains acceptable with new hover functionality

### **User Experience Requirements**
- [ ] Hover interaction is intuitive and responsive
- [ ] Button positioning doesn't interfere with video playback
- [ ] Loading states provide clear feedback
- [ ] Error messages are helpful and actionable
- [ ] Upload modal experience is identical to existing video uploads

## 🚀 Implementation Order

1. **Phase 1**: Create `VideoWithUploadDownload` component
2. **Phase 2**: Integrate component into `ContentClientPage`
3. **Phase 3**: Test download functionality thoroughly
4. **Phase 4**: Test upload functionality thoroughly
5. **Phase 5**: Test responsive design and edge cases
6. **Phase 6**: Final integration testing

## 📊 File Size and Format Support

### **Supported Video Formats**
- **MP4** (recommended)
- **WebM**
- **MOV**
- **Maximum Size**: 400MB per video

### **Download Filename Examples**
- `My_Content_Title_social_long_video_2024-01-15.mp4`
- `Another_Video_Title_social_short_video_2024-01-15.webm`
- `Content_Title_social_long_video_2024-01-15.mov`

---

## ✅ Implementation Status: **READY TO IMPLEMENT**

This PRD leverages all existing infrastructure and follows established patterns. The implementation should be straightforward since it reuses:
- Existing video upload modal and validation
- Existing server actions for database updates
- Existing Supabase storage and RLS policies
- Existing file naming conventions for storage
- Established hover interaction patterns from images

**Next Steps**: Begin implementation with Phase 1 (Create VideoWithUploadDownload component)

---

## ✅ **IMPLEMENTATION COMPLETE - ALL PHASES DONE**

### **Video Thumbnail Display Fix**

#### **Issue**: Create Video Section Not Showing Video Thumbnails
The `VideoPlayer` component was showing placeholder "Click to load and play video" text instead of the actual video thumbnail (first frame).

#### **Solution**: Updated VideoPlayer Component
- **Removed placeholder interface** - No more "Click to load and play video" placeholder
- **Show video immediately** - Video element now displays right away with `preload="metadata"`
- **Added cache busting** - Implemented same cache busting logic as social video sections
- **Added key prop** - Added `key={src}` to force re-render when src changes
- **Simplified component** - Removed loading state management and click handlers

#### **Result**: 
The Create Video page now shows actual video thumbnails (first frames) immediately when loaded, matching the behavior of the social video sections.

### **Video Upload Modal Filename Overflow Fix**

#### **Issue**: Long Filenames Breaking Modal Layout
Long video filenames were extending outside the modal boundaries, creating a poor user experience.

#### **Solution**: Intelligent Filename Truncation
- **Increased modal width** from `max-w-md` to `max-w-lg` for better space utilization
- **Added intelligent filename truncation** that preserves the file extension
- **Smart truncation logic** shows beginning of filename + "..." + extension (e.g., "Long_Video_Name...mp4")
- **Tooltip on hover** shows full filename when truncated
- **Improved layout constraints** with proper flexbox constraints

#### **Result**: 
Filenames now stay within modal boundaries with intelligent truncation that preserves the most important information (name start + extension).

### **Complete Cache Busting Solution**

#### **1. Client-Side Video URL Cache Busting**
- **Added `getVideoUrl()` function** that adds `?v=${timestamp}` to video URLs
- **Updated both video elements** to use cache-busted URLs:
  - Social Long Video: `src={getVideoUrl(content.video_long_url)}`
  - Social Short Video: `src={getVideoUrl(content.video_short_url)}`

#### **2. Download Cache Busting**
- **Updated download functionality** to use cache-busted URLs for fetching latest video

#### **3. Infrastructure Updates**
- **Middleware**: Updated cache control headers to include video formats
- **Vercel Config**: Added video formats to cache control rules
- **VideoPlayer**: Added cache busting for consistent behavior

### **All Tasks Completed Successfully** ✅ 