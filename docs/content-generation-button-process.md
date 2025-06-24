# Content Generation Button Process Documentation

## Overview

This document outlines the complete process flow for the content generation feature in Transformo, from user interaction to completion. The system integrates with N8N workflows to automatically generate content assets while providing real-time UI feedback and form protection.

## Process Flow

### 1. User Initiates Generation

**Location**: Content detail page (`/content/[id]`)
**Component**: `ContentAssetsManager`
**Button**: "Regenerate Content"

#### User Interaction:
1. User clicks "Regenerate Content" button
2. Confirmation dialog appears with warning message:
   ```
   Warning, if you regenerate content your old content will be lost, 
   do you want to regenerate content now? It will overwrite your images and content
   ```
3. Dialog has red-styled OK/Cancel buttons
4. User confirms by clicking OK

### 2. Generation Initiation

**File**: `app/(app)/content/[id]/actions.ts`
**Function**: `generateContent()`

#### Database Update:
```sql
UPDATE content 
SET content_generation_status = 'generating' 
WHERE id = [content_id]
```

#### N8N Workflow Trigger:
- **Endpoint**: Content creation webhook in N8N
- **Method**: POST
- **Payload**: Business details, content information, callback URL
- **Callback URL**: `${NEXT_PUBLIC_APP_URL}/api/n8n/callback`

### 3. UI State Changes (Immediate)

**Component**: `ContentDetailClientPage`

#### Visual Feedback:
- ✅ **"Generating..." status badge** appears in page header with spinner
- ✅ **"Regenerate Content" button becomes disabled**
- ✅ **All form fields become disabled** across all content asset types
- ✅ **Warning messages appear** in each form: "Content is being regenerated. Editing is temporarily disabled."

#### Form Components Affected:
- BlogPostForm (title, meta description, URL, rich text content)
- EmailForm (subject, rich text content)
- YouTubeVideoForm (title, description)
- SocialRantPostForm (post content)
- SocialBlogPostForm (post content)
- SocialLongVideoForm (post content)
- SocialShortVideoForm (post content)
- SocialQuoteCardForm (post content)

### 4. N8N Workflow Processing

**Environment**: N8N instance
**Workflow**: Content Creation workflow

#### Process Steps:
1. Receives webhook trigger with content details
2. Processes business information and content requirements
3. Generates various content assets (blog posts, social media content, emails, etc.)
4. Creates images for visual content
5. Saves generated content to database
6. Triggers completion callback

### 5. N8N Completion Callback

**Endpoint**: `/api/n8n/callback`
**File**: `app/api/n8n/callback/route.ts`

#### Callback Payload:
```json
{
  "content_id": "uuid",
  "workflow_type": "content_creation",
  "success": true,
  "environment": "development|production",
  "timestamp": "ISO-8601-timestamp"
}
```

#### Database Update on Success:
```sql
UPDATE content 
SET content_generation_status = 'completed' 
WHERE id = [content_id]
```

#### Database Update on Failure:
```sql
UPDATE content 
SET content_generation_status = 'failed' 
WHERE id = [content_id]
```

### 6. UI Status Polling & Updates

**Component**: `ContentDetailClientPage`
**Mechanism**: Polling every 5 seconds during generation

#### Polling Logic:
```typescript
useEffect(() => {
  let pollInterval: NodeJS.Timeout;
  
  if (isContentGenerating && supabase) {
    pollInterval = setInterval(async () => {
      // Check content_generation_status in database
      // Update UI when status changes from 'generating'
    }, 5000);
  }
  
  return () => clearInterval(pollInterval);
}, [isContentGenerating]);
```

#### On Completion Detection:
- ✅ **Remove "Generating..." status badge**
- ✅ **Re-enable "Regenerate Content" button**
- ✅ **Re-enable all form fields**
- ✅ **Remove disabled warning messages**
- ✅ **Show success toast notification**
- ✅ **Refresh content assets** to show new generated content

### 7. Error Handling

#### N8N Workflow Failure:
- Status set to 'failed' in database
- Error toast shown to user
- Forms re-enabled for manual editing
- Button becomes available for retry

#### Callback URL Issues:
- Environment variables must be properly configured
- N8N HTTP Request node URL: `https://transformo-dev-u48163.vm.elestio.app/api/n8n/callback`
- Headers include authentication bypass for Vercel

#### Polling Failure:
- Console error logged
- Status check retried on next interval
- Manual page refresh will restore proper state

## Database Schema

### Content Table Fields

```sql
content (
  id UUID PRIMARY KEY,
  content_generation_status TEXT, -- 'generating' | 'completed' | 'failed' | NULL
  content_title TEXT,
  transcript TEXT,
  video_script TEXT,
  -- ... other fields
)
```

### Content Assets Table

Generated assets stored in `content_assets` table with types:
- `youtube_video`
- `blog_post`
- `email`
- `social_rant_post`
- `social_blog_post`
- `social_long_video`
- `social_short_video`
- `social_quote_card`

## User Experience Guidelines

### Visual Feedback Requirements
1. **Immediate Response**: UI changes must occur instantly on button click
2. **Clear Status**: "Generating..." badge with spinner provides ongoing feedback
3. **Form Protection**: All editable fields disabled to prevent data loss
4. **Clear Messaging**: Consistent warning message across all forms
5. **Automatic Recovery**: No manual refresh required when generation completes

### Accessibility Considerations
- Disabled fields have proper ARIA attributes
- Status changes announced to screen readers
- Visual contrast maintained in disabled state
- Keyboard navigation preserved

## Technical Implementation Details

### Form Disabling Mechanism

**Pattern Used Across All Forms:**
```typescript
interface FormProps {
  asset: ContentAsset;
  disabled?: boolean;
}

export default function Form({ asset, disabled }: FormProps) {
  const handleSave = async (field: string, value: string) => {
    if (disabled) return; // Block saves when disabled
    // ... save logic
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Form Title</CardTitle>
        {disabled && (
          <p className="text-sm text-muted-foreground">
            Content is being regenerated. Editing is temporarily disabled.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Input disabled={disabled} />
        <Textarea disabled={disabled} />
        <RichTextEditor disabled={disabled} />
      </CardContent>
    </Card>
  );
}
```

### Rich Text Editor Disabling

**Special Implementation for Tiptap Editor:**
```typescript
const editor = useEditor({
  editable: !disabled,
  editorProps: {
    attributes: {
      class: `prose ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`,
    },
  },
});

// Update editable state when disabled prop changes
useEffect(() => {
  if (editor) {
    editor.setEditable(!disabled);
  }
}, [editor, disabled]);
```

## Configuration

### Environment Variables Required

```env
NEXT_PUBLIC_APP_URL=https://your-domain.com
N8N_WEBHOOK_URL_CONTENT_CREATION=https://n8n-instance.com/webhook/create-content
```

### N8N Webhook Configuration

**HTTP Request Node Settings:**
- URL: `https://transformo-dev-u48163.vm.elestio.app/api/n8n/callback`
- Method: POST
- Headers:
  - `Content-Type: application/json`
  - `x-vercel-protection-bypass: [secret]`

## Monitoring & Debugging

### Database Queries for Status Monitoring

```sql
-- Check content generation status
SELECT id, content_title, content_generation_status, updated_at 
FROM content 
WHERE content_generation_status = 'generating';

-- Check recent content generation activity
SELECT id, content_title, content_generation_status, updated_at 
FROM content 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

### Log Monitoring

**Key Log Patterns:**
- `N8N callback received:` - Callback webhook received
- `Content generation completed successfully` - Successful completion
- `Content generation failed` - Process failure
- `Error polling content status:` - Polling issues

## Future Enhancements

### Potential Improvements
1. **Progress Tracking**: Show generation progress percentage
2. **Real-time Updates**: Replace polling with WebSocket/Server-Sent Events
3. **Cancellation**: Allow users to cancel in-progress generation
4. **Queue Management**: Handle multiple concurrent generations
5. **Retry Logic**: Automatic retry on transient failures
6. **Detailed Error Messages**: More specific error feedback for different failure modes

---

*Last Updated: December 2024*
*Version: 1.0* 