# PRD: Image Regeneration Feature

## 📋 Overview

This document outlines the implementation of an AI-powered image regeneration feature for content assets on the content details page. Users will be able to regenerate images for blog posts, social media content, and YouTube thumbnails using an AI workflow through N8N.

## 🎯 Goal

Provide users with the ability to easily regenerate and replace images in their content assets using AI, with an intuitive interface that allows for prompt editing and image comparison before finalizing changes.

## 🔧 Technical Architecture

### **Content Types with Image Support**
- `blog_post` - Blog post featured image
- `social_blog_post` - Social media post image  
- `social_quote_card` - Quote card image
- `social_rant_post` - Social media rant image
- `youtube_video` - Video thumbnail image

### **File Storage Pattern**
Images are stored in Supabase storage with the naming convention:
```
{contentId}_{contentType}.{extension}
```
Example: `c3fe5b3f-76b1-4005-b31e-59b276ba4dbc_blog.jpg`

### **N8N Integration**
- **Webhook URL**: `N8N_WEBHOOK_IMAGE_REGENERATION`
- **Payload Structure**:
```json
{
  "contentAsset": {
    "id": "uuid",
    "content_id": "uuid", 
    "content_type": "blog_post",
    "image_prompt": "user-edited prompt",
    "headline": "content headline",
    "content": "content body"
  },
  "callbackUrl": "https://app-url/api/n8n/callback",
  "callbackSecret": "secret",
  "environment": "development"
}
```

## 🎨 User Experience Flow

### **Step 1: Trigger Regeneration**
1. User sees AI regeneration button (🤖 icon) in top-right corner of any image
2. User clicks the button to open the regeneration modal

### **Step 2: Edit Prompt (Optional)**
1. Modal opens showing:
   - Current image preview
   - Pre-filled prompt from `content_assets.image_prompt` field
   - Editable text area for prompt modification
2. User can edit the prompt or keep the existing one

### **Step 3: Generate New Image**
1. User clicks "Regenerate Image" button
2. Modal shows loading state while N8N processes the request
3. N8N returns new image URL via callback

### **Step 4: Compare & Select**
1. Modal now shows responsive image comparison:
   - **Desktop**: Side-by-side layout (original left, new right)
   - **Mobile**: Stacked layout (original top, new bottom)
2. User selects which image they prefer (radio buttons)
3. Options: "Keep Current", "Use New Image", or "Regenerate Again"

### **Step 5: Save Changes**
1. If user selects new image and clicks "Save":
   - New image overwrites old file in Supabase storage (same filename)
   - `content_assets.image_url` updated if URL changed
   - `content_assets.image_prompt` updated with edited prompt
2. If user clicks "Cancel" or selects current image:
   - No changes made, modal closes

## 🏗️ Implementation Plan

### **[ ] Phase 1: Core Components**

#### **[ ] 1.1 Create ImageWithRegeneration Wrapper Component**
- **File**: `components/shared/image-with-regeneration.tsx`
- **Purpose**: High-level reusable wrapper that handles all regeneration logic
- **Props**: 
  ```typescript
  interface Props {
    contentAsset: ContentAsset;
    children: React.ReactNode; // The actual image component
    disabled?: boolean;
    className?: string;
  }
  ```
- **Features**: 
  - Wraps any image component
  - Handles overlay button positioning
  - Manages modal state
  - Works in both forms and read-only displays

#### **[ ] 1.2 Create ImageRegenerationModal Component**
- **File**: `components/shared/image-regeneration-modal.tsx`
- **Purpose**: Main popup for image regeneration workflow
- **Features**:
  - Current image display
  - Editable prompt text area with sanitization
  - Loading states during generation with progress steps
  - Responsive image comparison (side-by-side on desktop, stacked on mobile)
  - Radio button selection with keyboard navigation
  - Save/Cancel/Regenerate actions
  - Focus management and accessibility features

### **[ ] Phase 2: API Integration**

#### **[ ] 2.1 Create N8N Trigger API Route**
- **File**: `app/api/n8n/image-regeneration/route.ts`
- **Purpose**: Trigger N8N image regeneration workflow
- **Method**: POST
- **Features**:
  - Input validation and sanitization
  - Rate limiting protection (5 requests per 10 minutes)
  - User permission checks
  - Structured error logging
- **Response**: Success/error status with detailed error codes

#### **[ ] 2.2 Update N8N Callback Handler**
- **File**: `app/api/n8n/callback/route.ts` (existing)
- **Purpose**: Handle image regeneration completion
- **New workflow type**: `image_regeneration`
- **Features**:
  - URL validation for security
  - Image format validation
  - Cache busting timestamp generation
- **Expected callback data**:
  ```json
  {
    "content_asset_id": "uuid",
    "workflow_type": "image_regeneration", 
    "success": true,
    "new_image_url": "https://...",
    "generation_timestamp": "2024-01-01T00:00:00Z",
    "environment": "development"
  }
  ```

#### **[ ] 2.3 Create Server Actions**
- **File**: `app/(app)/content/[id]/actions.ts` (existing file)
- **New Actions**:
  - `triggerImageRegeneration(contentAssetId, imagePrompt)` - With retry logic
  - `updateContentAssetImage(contentAssetId, imageUrl, imagePrompt)` - Atomic updates
  - `validateUserPermissions(userId, contentAssetId)` - Permission checks

### **[ ] Phase 3: Security & Validation**

#### **[ ] 3.1 Input Sanitization & Validation**
- Sanitize image prompts to prevent XSS
- Validate N8N response URLs against allowed domains
- Implement CSRF protection for API routes
- Add request rate limiting per user (5 requests per 10 minutes)

#### **[ ] 3.2 Permission & Access Control**
- Verify user can edit the content asset
- Check business subscription status for feature access
- Implement basic audit logging for regeneration attempts

### **[ ] Phase 4: UI Integration**

#### **[ ] 4.1 Wrap Images with Regeneration Component**
- **Strategy**: Use the new `ImageWithRegeneration` wrapper
- **Files to update**:
  - `components/shared/content-asset-forms/blog-post-form.tsx`
  - `components/shared/content-asset-forms/social-blog-post-form.tsx`
  - `components/shared/content-asset-forms/social-quote-card-form.tsx`
  - `components/shared/content-asset-forms/social-rant-post-form.tsx`
  - `components/shared/content-asset-forms/youtube-video-form.tsx`
  - `components/shared/content-client-page.tsx` (multiple sections)

#### **[ ] 4.2 Button Styling & Accessibility**
- High contrast button design for visibility on all backgrounds
- Proper ARIA labels and descriptions
- Keyboard navigation support
- Focus indicators and hover states

### **[ ] Phase 5: Enhanced UX & Performance (FUTURE)**

#### **[ ] 5.1 Advanced Loading States**
- Multi-step progress indicators with descriptive text
- Optimistic UI updates with loading overlays
- Graceful degradation for slow networks
- Network state detection (online/offline)

#### **[ ] 5.2 Error Handling & Recovery**
- Automatic retry with exponential backoff
- Detailed error messages with suggested actions
- Fallback behavior when N8N is unavailable
- Concurrent edit detection and resolution

#### **[ ] 5.3 Performance Optimizations**
- Image preloading for faster comparisons
- Modal lazy loading to reduce bundle size
- Debounced regeneration requests
- Cache busting for image updates

#### **[ ] 5.4 Mobile & Responsive Design**
- Touch-friendly interaction areas
- Optimized modal sizing for small screens
- Swipe gestures for image comparison (optional)
- Enhanced mobile accessibility

### **[ ] Phase 6: Monitoring & Analytics (FUTURE)**

#### **[ ] 6.1 Usage Analytics**
- Track regeneration success/failure rates
- Monitor popular content types for regeneration
- Measure user engagement with the feature
- A/B testing framework for UX improvements

#### **[ ] 6.2 Error Monitoring & Alerting**
- Structured error logging with context
- Real-time error rate monitoring
- Automated alerts for high failure rates
- Performance metrics and bottleneck identification

## 🔧 Technical Specifications

### **Environment Variables**
```bash
# Add to .env.local
N8N_WEBHOOK_IMAGE_REGENERATION=https://transformo-dev-u48163.vm.elestio.app/webhook-test/image-regeneration

# Security & Rate Limiting
REGENERATION_RATE_LIMIT_WINDOW=600000    # 10 minutes
REGENERATION_RATE_LIMIT_MAX=5            # Max 5 requests per 10 minutes

# Performance
IMAGE_PRELOAD_TIMEOUT=10000              # 10 second timeout for image preloading
```

### **Database Fields Used**
- `content_assets.id` - Asset identifier
- `content_assets.content_id` - Parent content ID
- `content_assets.content_type` - Type of content asset
- `content_assets.image_url` - Current image URL
- `content_assets.image_prompt` - AI generation prompt
- `content_assets.headline` - Content headline (context)
- `content_assets.content` - Content body (context)

### **Supabase Storage**
- **Bucket**: `images`
- **Permissions**: Service role for uploads/overwrites
- **File naming**: `{contentId}_{contentType}.{extension}`
- **Overwrite strategy**: Same filename replacement with cache busting
- **Cache Control**: `max-age=31536000, public` with timestamp queries

### **Component Architecture**
```
ImageWithRegeneration (High-level wrapper)
    ├── children (Image component passed in)
    ├── RegenerationButton (Overlay positioned, conditionally rendered)
    └── ImageRegenerationModal (When active)
        ├── CurrentImagePreview (With loading states)
        ├── PromptEditor (With sanitization)
        ├── RegenerateButton (With rate limiting)
        ├── ProgressIndicator (Simple loading feedback)
        ├── ImageComparison (Responsive: side-by-side desktop, stacked mobile)
        │   ├── OriginalImage (Radio + keyboard nav)
        │   └── NewImage (Radio + keyboard nav)
        └── ActionButtons (Save/Cancel/Retry)
```

## 🧪 Testing Strategy

### **[ ] Unit Tests**
- [ ] ImageWithRegeneration wrapper component
- [ ] ImageRegenerationModal state management
- [ ] API route input validation and sanitization
- [ ] Server action error handling and retries
- [ ] Permission checking logic

### **[ ] Integration Tests**
- [ ] End-to-end image regeneration flow
- [ ] N8N webhook integration with error scenarios
- [ ] File storage operations with cache busting
- [ ] Database consistency after operations
- [ ] Rate limiting enforcement

### **[ ] Accessibility Tests**
- [ ] Keyboard navigation through entire flow
- [ ] Screen reader compatibility
- [ ] Focus management and announcements
- [ ] Color contrast compliance
- [ ] Mobile touch accessibility

### **[ ] Responsive Design Tests**
- [ ] Side-by-side layout on desktop screens
- [ ] Stacked layout on mobile devices
- [ ] Modal responsiveness across breakpoints
- [ ] Touch interactions on mobile

### **[ ] Security Tests**
- [ ] XSS prevention in image prompts
- [ ] URL validation against malicious inputs
- [ ] Rate limiting bypass attempts
- [ ] Permission escalation scenarios

## 🚀 Deployment Checklist

### **[ ] Pre-Deployment**
- [ ] Environment variables configured
- [ ] N8N workflow endpoint tested with validation
- [ ] Database migrations (if needed)
- [ ] Storage permissions verified
- [ ] Rate limiting configuration tested (5 per 10 minutes)
- [ ] Security headers configured

### **[ ] Post-Deployment**
- [ ] Verify button appears on all image content types
- [ ] Test complete regeneration workflow on different devices
- [ ] Monitor N8N callback success rates
- [ ] Check error logging systems
- [ ] Verify responsive layout (side-by-side desktop, stacked mobile)
- [ ] Test accessibility features

## 🔍 Success Metrics

- **Functionality**: Button appears on all images in supported content types
- **Performance**: Image regeneration completes within 30 seconds (95th percentile)
- **Reliability**: >98% success rate for regeneration workflow
- **Usability**: Users can complete regeneration flow without confusion
- **Storage**: Old images properly replaced without orphaned files
- **Security**: Zero XSS vulnerabilities, rate limiting blocks abuse
- **Accessibility**: WCAG 2.1 AA compliance verified
- **Responsive**: Proper layout on both desktop and mobile devices

## 📝 Implementation Notes

- **Reusability**: Single wrapper component works across all content types
- **Consistency**: Follows existing patterns for N8N integration and storage
- **Scalability**: Architecture supports future extensions (Phases 5-6)
- **Accessibility**: Full WCAG 2.1 AA compliance with keyboard navigation
- **Responsive**: Side-by-side on desktop, stacked on mobile
- **Security**: Comprehensive input validation and rate limiting
- **Rate Limiting**: 5 regenerations per 10-minute window per user

## 🚨 Critical Security Considerations

### **Input Validation**
```typescript
// Sanitize all user inputs
const sanitizeImagePrompt = (prompt: string): string => {
  return DOMPurify.sanitize(prompt.trim().substring(0, 1000));
};
```

### **URL Validation**
```typescript
// Validate N8N response URLs
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.endsWith('.supabase.co') && 
           parsedUrl.pathname.includes('/storage/v1/object/public/images/');
  } catch {
    return false;
  }
};
```

### **Rate Limiting**
```typescript
// Implement per-user rate limiting - 5 requests per 10 minutes
const REGENERATION_COOLDOWN = 600000; // 10 minutes
const REGENERATION_MAX_REQUESTS = 5;
const userRequestHistory = new Map<string, number[]>();
```

## 🎯 Next Steps

**Ready to implement Phase 1-4** - Core functionality:
1. `ImageWithRegeneration` wrapper component
2. `ImageRegenerationModal` component with responsive layout
3. N8N API integration with rate limiting
4. Security validation and UI integration

**Future Phases 5-6** available for later enhancement:
- Advanced UX features and performance optimizations
- Usage analytics and monitoring capabilities

This plan delivers solid core functionality first, with a clear path for future enhancements. 