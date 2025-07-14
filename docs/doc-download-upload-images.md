# PRD: Image Download & Upload Functionality

## 📋 Overview

This document outlines the implementation of image download and upload functionality for the content details page. Users will be able to download existing images and upload new images to replace existing ones.

**Integration with Existing Systems:**
- ✅ **Leverages existing image regeneration hover UI** (`ImageWithRegeneration` component)
- ✅ **Follows existing content assets naming pattern** (`{content_asset_id}_{content_type}.{extension}`)
- ✅ **Integrates with existing database schema** (content_assets table)
- ✅ **Uses existing Supabase storage infrastructure** (images bucket with RLS policies)

## 🎯 Goals

1. **Download Functionality**: Allow users to download images from content assets directly to their computer
2. **Upload Functionality**: Allow users to upload new images to replace existing ones
3. **Seamless Integration**: Integrate with existing image regeneration UI without disrupting current workflows
4. **Consistent UX**: Follow existing patterns and visual design
5. **Simple Implementation**: Use existing upload patterns and storage infrastructure

## 🏗️ Technical Architecture

### **Existing Components to Leverage**

#### **1. ImageWithRegeneration Component**
- **Location**: `components/shared/image-with-regeneration.tsx`
- **Current State**: Shows AI regeneration button on hover
- **Enhancement**: Add download and upload buttons alongside existing regeneration button

#### **2. Existing Upload Infrastructure**
- **Supabase Storage**: Images bucket with RLS policies
- **Upload Patterns**: Existing patterns in `/api/upload-image` route
- **File Naming**: UUID-based naming for security
- **API Endpoint**: Can extend existing upload patterns or create new endpoint

#### **3. Database Schema (Existing)**
```sql
-- content_assets table (already exists)
content_assets {
  id uuid PRIMARY KEY,
  content_id uuid,
  content_type text,
  image_url text,           -- Current image URL
  temporary_image_url text, -- Used for regeneration workflow
  -- ... other existing fields
}
```

#### **4. Storage Pattern (Existing)**
- **Bucket**: `images` (already exists)
- **Naming**: `{content_asset_id}_{content_type}.{extension}`
- **Examples**: 
  - `f3d2c8b1-7e92-4a33-8f1e-2b5c9a8d7e6f_blog_post.webp`
  - `a1b2c3d4-5e6f-7890-abcd-ef1234567890_social_rant_post.webp`

### **Supported Content Types**
- `blog_post` - Blog post featured image
- `social_blog_post` - Social media post image  
- `social_quote_card` - Quote card image
- `social_rant_post` - Social media rant image
- `youtube_video` - Video thumbnail image

## 🎨 User Experience Flow

### **Enhanced Hover UI**
When user hovers over any image with `ImageWithRegeneration` wrapper:

```
[Download] [Upload] [🤖 AI Regenerate]
```

**Visual Layout:**
- **Download Icon**: ⬇️ (Download arrow)
- **Upload Icon**: ⬆️ (Upload arrow) 
- **AI Regenerate**: 🤖 (Existing button)
- **Positioning**: Left to right, top-right corner of image
- **Spacing**: 8px between buttons

### **Download Flow**
1. User hovers over image
2. User clicks download button (⬇️)
3. Browser downloads image from `content_assets.image_url`
4. File saves as: `{content_type}_image_{timestamp}.{extension}`
   - Example: `blog_post_image_2024-01-15.webp`

### **Upload Flow**
1. User hovers over image
2. User clicks upload button (⬆️)
3. File picker opens (accepts: `.jpg`, `.jpeg`, `.png`, `.webp`)
4. User selects image file
5. **File uploads directly to Supabase Storage** (following existing patterns)
6. Uploaded image replaces current image in `content_assets.image_url`
7. UI updates with new image immediately

## 🔧 Implementation Plan

### **Phase 1: Enhance ImageWithRegeneration Component**

#### **1.1 Update ImageWithRegeneration Props**
```typescript
interface ImageWithRegenerationProps {
  contentAsset: ContentAsset;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onImageUpdated?: (updatedAsset: ContentAsset) => void;
  // NEW: Enable/disable specific features
  enableDownload?: boolean;
  enableUpload?: boolean;
  enableRegeneration?: boolean;
}
```

#### **1.2 Add Button Icons**
- **Download**: `import { Download } from 'lucide-react'`
- **Upload**: `import { Upload } from 'lucide-react'`
- **File Input**: Hidden file input for upload functionality

#### **1.3 Enhanced Button Layout**
```jsx
{/* Button Group - appears on hover */}
<div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2">
  
  {/* Download Button */}
  {enableDownload && (
    <Button
      variant="secondary"
      size="sm"
      className="bg-green-600 hover:bg-green-700 text-white"
      onClick={handleDownload}
    >
      <Download className="h-4 w-4" />
    </Button>
  )}
  
  {/* Upload Button */}
  {enableUpload && (
    <Button
      variant="secondary"
      size="sm"
      className="bg-blue-600 hover:bg-blue-700 text-white"
      onClick={handleUpload}
    >
      <Upload className="h-4 w-4" />
    </Button>
  )}
  
  {/* AI Regeneration Button (existing) */}
  {enableRegeneration && (
    <Button
      variant="secondary"
      size="sm"
      className="bg-purple-600 hover:bg-purple-700 text-white"
      onClick={handleRegenerationStart}
    >
      <Bot className="h-4 w-4 mr-1" />
      <span className="text-xs font-medium">AI</span>
    </Button>
  )}
</div>

{/* Hidden File Input */}
<input
  type="file"
  ref={fileInputRef}
  className="hidden"
  accept=".jpg,.jpeg,.png,.webp"
  onChange={handleFileSelect}
/>
```

### **Phase 2: Implement Download Functionality**

#### **2.1 Download Handler**
```typescript
const handleDownload = async () => {
  if (!contentAsset.image_url) return;

  try {
    // Fetch image data
    const response = await fetch(contentAsset.image_url);
    const blob = await response.blob();
    
    // Create download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const extension = contentAsset.image_url.split('.').pop() || 'jpg';
    a.download = `${contentAsset.content_type}_image_${timestamp}.${extension}`;
    
    // Trigger download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Image downloaded successfully!');
  } catch (error) {
    console.error('Download error:', error);
    toast.error('Failed to download image');
  }
};
```

### **Phase 3: Implement Upload Functionality**

#### **3.1 Upload Handler**
```typescript
const handleUpload = () => {
  fileInputRef.current?.click();
};

const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast.error('Please select a valid image file');
    return;
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    toast.error('Image must be less than 10MB');
    return;
  }

  setIsUploading(true);
  
  try {
    // Call upload API (direct upload to Supabase)
    const result = await uploadImage({
      file,
      contentAssetId: contentAsset.id,
      contentType: contentAsset.content_type,
    });

    if (result.success) {
      // Update UI with new image
      if (onImageUpdated) {
        onImageUpdated({
          ...contentAsset,
          image_url: result.imageUrl,
        });
      }
      toast.success('Image uploaded successfully!');
    } else {
      toast.error(result.error || 'Upload failed');
    }
  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Failed to upload image');
  } finally {
    setIsUploading(false);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }
};
```

### **Phase 4: Create Upload API Endpoint**

#### **4.1 New API Route: `/api/upload-image-replace`**
```typescript
// app/api/upload-image-replace/route.ts
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const contentAssetId = formData.get('contentAssetId') as string;
    const contentType = formData.get('contentType') as string;

    if (!file || !contentAssetId || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Step 1: Generate filename following content assets pattern
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filename = `${contentAssetId}_${contentType}.${fileExtension}`;

    // Step 2: Convert file to buffer
    const fileBuffer = await file.arrayBuffer();

    // Step 3: Upload to Supabase storage (using service role to bypass RLS)
    const { data, error: uploadError } = await supabase.storage
      .from('images')
      .upload(filename, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true // Replace existing file
      });

    if (uploadError) {
      throw uploadError;
    }

    // Step 4: Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filename);

    // Step 5: Add cache busting for immediate UI update
    const cacheBustedUrl = `${publicUrl}?v=${Date.now()}`;

    // Step 6: Update content_assets table
    const { data: updatedAsset, error: updateError } = await supabase
      .from('content_assets')
      .update({ 
        image_url: cacheBustedUrl,
      })
      .eq('id', contentAssetId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      imageUrl: cacheBustedUrl,
      contentAsset: updatedAsset,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: 'Upload failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
```

#### **4.2 Helper Function for Supabase Client**
```typescript
// Create Supabase client with service role for server-side operations
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```

### **Phase 5: Update Content Client Pages**

#### **5.1 Enable Features in ContentClientPage**
```typescript
// In components/shared/content-client-page.tsx
// Update all ImageWithRegeneration usage:

<ImageWithRegeneration 
  contentAsset={contentAsset}
  className="block w-full"
  onImageUpdated={handleImageUpdated}
  enableDownload={true}  // NEW
  enableUpload={true}    // NEW
  enableRegeneration={true}
>
  <img 
    src={getImageUrl(contentAsset.image_url)} 
    alt="Content image"
    className="w-full object-cover rounded-lg"
  />
</ImageWithRegeneration>
```

## 🔄 Upload Process

### **File Extension Handling**
```typescript
const getFileExtension = (filename: string): string => {
  const extension = filename.split('.').pop()?.toLowerCase();
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  return validExtensions.includes(extension || '') ? extension! : 'jpg';
};
```

### **Upload Process Flow**
1. **Upload**: User selects image file
2. **Validate**: Check file type and size
3. **Generate**: Create filename using content assets pattern
4. **Store**: Upload directly to Supabase Storage (with upsert)
5. **Update**: Database updated with new image URL (with cache busting)
6. **Refresh**: UI updates with new image immediately

## 🧪 Testing Checklist

### **Download Functionality**
- [ ] Download works for all supported image formats (webp, jpg, png)
- [ ] Downloaded filename follows naming convention
- [ ] Download works with both local and production Supabase URLs
- [ ] Error handling for network failures
- [ ] Download button only appears when image exists

### **Upload Functionality**
- [ ] File picker only accepts image files
- [ ] File size validation (max 10MB)
- [ ] File extension validation and handling
- [ ] Upload progress indication
- [ ] Database updates correctly after upload
- [ ] UI refreshes with new image (cache busting works)
- [ ] Error handling for upload failures
- [ ] Error handling for storage failures

### **UI/UX Testing**
- [ ] Hover state shows all three buttons correctly
- [ ] Button spacing and positioning looks good
- [ ] Icons are clear and recognizable
- [ ] Loading states work properly
- [ ] Toast notifications appear for all actions
- [ ] Responsive design works on mobile

### **Integration Testing**
- [ ] Upload doesn't interfere with existing regeneration
- [ ] Download doesn't interfere with other functionality
- [ ] Works across all content types
- [ ] Works in both local and production environments
- [ ] Supabase storage integration works correctly

## 📁 Files to Create/Modify

### **New Files**
- [ ] `app/api/upload-image-replace/route.ts` - Upload API for replacing content asset images
- [ ] `lib/image-upload.ts` - Upload helper functions (optional)

### **Modified Files**
- [ ] `components/shared/image-with-regeneration.tsx` - Add download/upload buttons
- [ ] `components/shared/content-client-page.tsx` - Enable new features
- [ ] `types/index.ts` - Add new prop types if needed

### **Existing Files to Leverage**
- ✅ `app/api/upload-image/route.ts` - Reference for Supabase upload patterns
- ✅ `app/api/content-assets/[id]/route.ts` - Reference for content asset updates
- ✅ `components/shared/image-regeneration-modal.tsx` - Reference for UI patterns
- ✅ Supabase storage configuration - Already handles image uploads

## 🎯 Success Metrics

### **Functionality Metrics**
- **Download Success Rate**: >99% for all supported formats
- **Upload Success Rate**: >95% for direct uploads
- **Processing Time**: <5 seconds for image upload and database update
- **UI Response Time**: <1 second for image refresh after upload

### **User Experience Metrics**
- **Intuitive UI**: Users can find and use features without documentation
- **Performance**: No UI lag during hover or button interactions
- **Error Handling**: Clear error messages for all failure scenarios
- **Consistency**: Matches existing design patterns and interactions

## 🔒 Security Considerations

### **Upload Security**
- **File Type Validation**: Only allow image files
- **File Size Limits**: Maximum 10MB per upload
- **Content Type Validation**: Validate actual file content, not just extension
- **Service Role Usage**: Use Supabase service role to bypass RLS for server-side operations

### **Download Security**
- **URL Validation**: Ensure downloads only work for user's own content
- **Rate Limiting**: Prevent abuse of download functionality
- **Access Control**: Respect existing RLS policies

### **Storage Security**
- **Filename Sanitization**: Use UUID-based naming to prevent path traversal
- **Overwrite Protection**: Use upsert for safe file replacement
- **Bucket Policies**: Leverage existing Supabase RLS policies

## 🚀 Deployment Strategy

### **Development Phase**
1. **Local Testing**: Test with local Supabase instance
2. **Storage Testing**: Verify Supabase storage upload/download
3. **UI Testing**: Test button layouts and interactions
4. **Error Testing**: Test all failure scenarios

### **Staging Phase**
1. **Production Storage**: Test with production Supabase instance
2. **Performance Testing**: Test with larger image files
3. **Cross-browser Testing**: Verify download functionality across browsers
4. **Mobile Testing**: Test responsive design and touch interactions

### **Production Release**
1. **Feature Flag**: Deploy behind feature flag for gradual rollout
2. **Monitoring**: Track upload/download success rates
3. **Performance**: Monitor Supabase storage response times
4. **User Feedback**: Collect feedback on new functionality

---

## ✅ Implementation Checklist

### **Phase 1: Component Enhancement**
- [ ] Add download/upload buttons to ImageWithRegeneration
- [ ] Implement file input and button handlers
- [ ] Add proper TypeScript types
- [ ] Test button layout and hover states

### **Phase 2: Download Functionality**
- [ ] Implement download handler
- [ ] Add filename generation logic
- [ ] Test with various image formats
- [ ] Add error handling

### **Phase 3: Upload API**
- [ ] Create upload-image-replace API route
- [ ] Implement direct Supabase storage upload
- [ ] Add file validation and security checks
- [ ] Test with various file types and sizes

### **Phase 4: Database Integration**
- [ ] Update content_assets table after upload
- [ ] Add cache busting for image URLs
- [ ] Test database transaction safety
- [ ] Verify RLS policies work correctly

### **Phase 5: UI Integration**
- [ ] Update ContentClientPage to enable new features
- [ ] Add loading states and progress indicators
- [ ] Implement toast notifications
- [ ] Test responsive design

### **Phase 6: Testing & Polish**
- [ ] Complete all testing checklist items
- [ ] Add comprehensive error handling
- [ ] Optimize performance
- [ ] Document any new environment variables

### **Phase 7: Deployment**
- [ ] Deploy to staging environment
- [ ] Conduct user acceptance testing
- [ ] Deploy to production with feature flags
- [ ] Monitor success metrics

---

**Status**: 📋 **READY FOR IMPLEMENTATION**

This PRD leverages existing architecture and components to minimize development effort while providing a seamless user experience. The implementation uses direct Supabase storage uploads for simplicity and reliability, following existing patterns in the codebase. 