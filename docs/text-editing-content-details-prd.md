# PRD: Text Editing for Content Details Page

This document outlines the implementation of in-line text editing functionality for the content details page, allowing users to edit various text fields through modal popups with appropriate input types (plain text, textarea, or HTML editor).

---

## **1. Goal**

Enable users to edit any text content displayed on the content details page through intuitive modal popups, providing a seamless editing experience with appropriate input controls and real-time updates.

## **2. User Problem**

Users currently cannot edit the generated content displayed on the content details page. They need the ability to:
- Edit plain text fields like titles, subject lines, and descriptions
- Edit rich content fields like blog post bodies and email content with HTML formatting
- See their changes reflected immediately without page refresh
- Have a consistent, intuitive editing interface across all content types

## **3. Features & Scope**

### **3.1. Editable Fields Overview**

| Content Section | Field | Database Location | Input Type | Rich Formatting |
|----------------|-------|------------------|------------|-----------------|
| Content Header | Page Title | `content.content_title` | Text Input | No |
| Video Script | Script Content | `content.video_script` | Textarea | No |
| Blog Post | Title | `content_assets.headline` | Text Input | No |
| Blog Post | Body | `content_assets.content` | HTML Editor | Yes |
| Blog Post | Meta Description | `content_assets.blog_meta_description` | Textarea | No |
| Blog Post | URL | `content_assets.blog_url` | Text Input | No |
| Email | Subject Line | `content_assets.headline` | Text Input | No |
| Email | Body | `content_assets.content` | HTML Editor | Yes |
| YouTube | Title | `content_assets.headline` | Text Input | No |
| YouTube | Description | `content_assets.content` | Textarea | No |
| Social Long Video | Content | `content_assets.content` | Textarea | No |
| Social Short Video | Content | `content_assets.content` | Textarea | No |
| Social Quote Card | Content | `content_assets.content` | Textarea | No |
| Social Rant Post | Content | `content_assets.content` | Textarea | No |
| Social Blog Post | Content | `content_assets.content` | Textarea | No |

### **3.2. Core Features**

- **Universal Edit Buttons**: Small icon buttons appearing next to each editable text field
- **Modal-Based Editing**: Consistent popup interface for all editing operations
- **Multiple Input Types**: Text input, textarea, and HTML editor based on field requirements
- **Real-Time Updates**: Changes reflected immediately in the display after saving
- **Save/Cancel Actions**: Clear action buttons with proper state management
- **Error Handling**: Graceful error handling with user feedback
- **Permission Checks**: Respect existing business permissions and content generation status

## **4. Technical Architecture**

### **4.1. Component Architecture**

```
ContentEditModal (Reusable)
├── Dialog (ShadCN)
├── FieldTypeHandlers
│   ├── TextInput
│   ├── Textarea  
│   └── HTMLEditor (TipTap)
├── SaveCancelActions
└── ErrorHandling
```

### **4.2. HTML Editor Technology**

**Selected Solution: TipTap**
- ✅ Most well-rounded choice for 2025 (industry consensus)
- ✅ Built on battle-tested ProseMirror
- ✅ MIT license (free, open source)
- ✅ Smaller bundle size than alternatives
- ✅ Excellent React integration
- ✅ Clean HTML output (not Markdown)
- ✅ Full toolbar support (H1-H4, bold, italic, lists)
- ✅ Tree-shakable packages
- ✅ Easy extension system

### **4.3. Data Flow**

```
User clicks edit button
→ ContentEditModal opens with current value
→ User makes changes
→ User clicks Save
→ API call to update database
→ Real-time UI update
→ Modal closes
```

### **4.4. Database Update Strategy**

- **Content Table**: Use existing `updateContentField` action for `video_script`
- **Content Assets Table**: Use existing `updateContentAsset` action for all other fields
- **Optimistic Updates**: Update UI immediately, revert on error
- **Error Recovery**: Clear error states and retry mechanisms

## **5. Implementation Plan**

### **Phase 1: Core Infrastructure** ✅ **COMPLETED**

#### **[x] 1.1: Create Reusable ContentEditModal Component**
- **File**: `components/shared/content-edit-modal.tsx`
- **Purpose**: Universal modal for all text editing operations
- **Features**:
  - Dialog structure using ShadCN components
  - Dynamic input type rendering
  - Save/Cancel functionality
  - Error handling and loading states
  - TypeScript interface for field configuration

#### **[x] 1.2: Create EditButton Component**
- **File**: `components/shared/edit-button.tsx`
- **Purpose**: Consistent edit button for all text fields
- **Features**:
  - Small icon button design
  - Hover states and accessibility
  - Click handler to open modal
  - Disabled state when content is generating

#### **[x] 1.3: Update Rich Text Editor**
- **Verify TipTap configuration for HTML output**
- **Ensure full toolbar functionality (H1-H4, bold, italic, lists)**
- **Test performance and bundle size**
- **Add proper disabled state handling**

### **Phase 2: Field Integration** ✅ **COMPLETED**

#### **[x] 2.1: Add Edit Buttons to Content Display**
- **Target Files**: 
  - `components/shared/content-client-page.tsx`
  - Update all content display sections
- **Implementation**:
  - Add EditButton next to each editable text field
  - Configure field metadata (type, database location, label)
  - Respect permission checks and generation status

#### **[x] 2.2: Content Title Integration**
- **Field**: `content.content_title`
- **Input Type**: Text Input (single line)
- **Action**: Use existing `updateContentField`

#### **[x] 2.3: Video Script Integration**
- **Field**: `content.video_script`
- **Input Type**: Textarea (plain text)
- **Action**: Use existing `updateContentField`

#### **[x] 2.4: Blog Post Fields Integration**
- **Title**: Text input → `content_assets.headline`
- **Body**: HTML editor → `content_assets.content`
- **Meta Description**: Textarea → `content_assets.blog_meta_description`
- **URL**: Text input → `content_assets.blog_url`

#### **[x] 2.5: Email Fields Integration**
- **Subject**: Text input → `content_assets.headline`
- **Body**: HTML editor → `content_assets.content`

#### **[x] 2.6: Social Media Fields Integration**
- **All social content types**: Textarea → `content_assets.content`
- **YouTube title**: Text input → `content_assets.headline`
- **YouTube description**: Textarea → `content_assets.content`

### **Phase 3: User Experience** ✅ **COMPLETED**

#### **[x] 3.1: Real-Time Updates**
- **Implement optimistic UI updates**
- **Add loading states during save operations**
- **Handle error states with user feedback**
- **Refresh content display after successful save**

#### **[x] 3.2: Permission and State Management**
- **Disable editing when `content_generation_status === 'generating'`**
- **Respect business permissions (existing RLS)**
- **Show appropriate disabled states and messages**

#### **[x] 3.3: Accessibility and UX**
- **Keyboard navigation support**
- **Screen reader compatibility**
- **Clear focus management**
- **Intuitive button placement and sizing**

### **Phase 4: Testing and Polish** 🔄 **IN PROGRESS**

#### **[x] 4.1: Component Testing**
- **Test modal opening/closing**
- **Test all input types (text, textarea, HTML editor)**
- **Test save/cancel functionality**
- **Test error handling**

#### **[x] 4.2: Integration Testing**
- **Test all content types and fields**
- **Test permission scenarios**
- **Test generation status handling**
- **Test real-time updates**

#### **[ ] 4.3: Performance Testing**
- **HTML editor loading time**
- **Large content handling**
- **Memory usage during editing**
- **Mobile responsiveness**

### **Phase 5: Documentation and Deployment** ⏳ **PENDING**

#### **[ ] 5.1: Component Documentation**
- **Document ContentEditModal API**
- **Document EditButton usage**
- **Add implementation examples**

#### **[ ] 5.2: Testing Documentation**
- **Document testing procedures**
- **Add regression test cases**
- **Performance benchmarks**

#### **[x] 5.3: Deployment**
- **Deploy to development environment**
- **User acceptance testing**
- **Production deployment**

## **6. Technical Specifications**

### **6.1. Component Interfaces**

```typescript
interface FieldConfig {
  label: string;
  value: string;
  fieldKey: string;
  inputType: 'text' | 'textarea' | 'html';
  placeholder?: string;
  maxLength?: number;
}

interface ContentEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldConfig: FieldConfig;
  onSave: (value: string) => Promise<void>;
  isLoading?: boolean;
}

interface EditButtonProps {
  fieldConfig: FieldConfig;
  onEdit: (config: FieldConfig) => void;
  disabled?: boolean;
  className?: string;
}
```

### **6.2. Database Actions**

```typescript
// For content table fields
updateContentField({
  contentId: string;
  fieldName: 'content_title' | 'video_script';
  newValue: string;
})

// For content_assets table fields  
updateContentAsset(assetId: string, updates: {
  headline?: string;
  content?: string;
  blog_meta_description?: string;
  blog_url?: string;
})
```

### **6.3. HTML Editor Configuration**

```typescript
// TipTap configuration for full blog editing
const extensions = [
  StarterKit, // Bold, italic, H1-H6, lists, quotes, etc.
  Link.configure({
    openOnClick: false,
    HTMLAttributes: {
      target: '_blank',
      rel: 'noopener noreferrer',
    },
  }),
  Image, // Support for pasted images
];

const editorProps = {
  attributes: {
    class: 'prose max-w-none focus:outline-none min-h-[200px]',
  },
  handlePaste: (view, event, slice) => {
    // Preserve formatting including images when pasting
    return false; // Let TipTap handle paste naturally
  },
};
```

## **7. User Experience Flow**

### **7.1. Standard Editing Flow**
1. User views content details page
2. User sees small edit icon next to any text field
3. User clicks edit icon
4. Modal opens with appropriate input type pre-filled
5. User makes changes
6. User clicks "Save" → Changes saved and reflected immediately
7. User clicks "Cancel" → Modal closes, no changes made

### **7.2. Error Handling Flow**
1. User attempts to save changes
2. Save button shows loading spinner, modal becomes disabled
3. If API request fails:
   - Error message displayed within modal (not toast)
   - Retry button appears in modal
   - Modal remains open for user to retry or cancel
4. User can retry save or cancel editing
5. Original content remains unchanged until successful save

### **7.3. Permission Handling**
1. Content is in "generating" state → Edit buttons disabled
2. User lacks permissions → Edit buttons hidden/disabled
3. Clear messaging about why editing is unavailable

## **8. Design Requirements**

### **8.1. Edit Button Design**
- **Size**: 24px button with 16px Edit icon (from Lucide)
- **Placement**: Floating on hover, positioned absolute in top-right corner of text container
- **Behavior**: Hidden by default, appears on hover of text container
- **Styling**: White background with subtle shadow, border, hover states
- **States**: Hidden, visible (on hover), disabled (when save in progress)
- **Accessibility**: Proper ARIA labels and keyboard focus

### **8.2. Modal Design**
- **Size**: Responsive, up to 600px width, max-height 80vh with scroll
- **Layout**: Header, content area, footer with actions
- **Styling**: Consistent with ImageRegenerationModal patterns
- **Focus Management**: Focus moves to stepper menu content type being edited (like image regeneration)
- **Keyboard**: ESC key does NOT close modal (matches image regeneration behavior)
- **Disabled State**: Entire modal disabled during save operations

### **8.3. Input Field Design**
- **Text Input**: Single line, standard height (40px)
- **Textarea**: Multi-line, minimum 4 rows, auto-grows with content
- **HTML Editor**: Full blog editing toolbar + content area, minimum 200px height
  - **Toolbar Features**: Bold, italic, H1-H6, bullet/numbered lists, links, blockquotes
  - **Link Support**: Full link editing with URL input
  - **Paste Handling**: Preserves formatting including images when pasted

## **9. Performance Considerations**

### **9.1. HTML Editor Performance**
- **Lazy Loading**: Load TipTap only when HTML editing is needed
- **Bundle Size**: Use tree-shaking to include only necessary extensions
- **Memory Management**: Properly dispose editor instances

### **9.2. Update Performance**
- **Optimistic Updates**: Update UI immediately
- **Debouncing**: Consider debouncing for auto-save features (future)
- **Minimal Re-renders**: Use React.memo and careful state management

## **10. Security Considerations**

### **10.1. Input Validation**
- **HTML Sanitization**: Ensure TipTap outputs safe HTML
- **Length Limits**: Respect database field constraints
- **XSS Prevention**: Proper HTML sanitization

### **10.2. Permission Enforcement**
- **RLS Compliance**: All updates respect Row Level Security
- **Business Permissions**: Check business ownership
- **Generation State**: Respect content generation locks

## **11. Future Enhancements**

### **11.1. Auto-Save** (Not in scope)
- **Periodic Auto-Save**: Save changes every 30 seconds
- **Draft Management**: Save drafts without publishing
- **Conflict Resolution**: Handle concurrent editing

### **11.2. Revision History** (Not in scope)
- **Version Tracking**: Track changes over time
- **Diff Viewing**: Show what changed
- **Rollback Capability**: Revert to previous versions

### **11.3. Advanced HTML Features** (Not in scope)
- **Image Insertion**: Direct image upload in HTML editor
- **Link Management**: Enhanced link editing
- **Table Support**: Rich table editing capabilities

## **12. Success Metrics**

### **12.1. Functional Metrics**
- ✅ All specified fields are editable
- ✅ Changes save successfully 99%+ of the time
- ✅ Real-time updates work consistently
- ✅ No data loss during editing operations

### **12.2. Performance Metrics**
- ✅ Modal opens in <200ms
- ✅ HTML editor loads in <500ms
- ✅ Save operations complete in <1000ms
- ✅ No memory leaks during extended use

### **12.3. User Experience Metrics**
- ✅ Intuitive edit button placement
- ✅ Clear feedback for all user actions
- ✅ Consistent behavior across all field types
- ✅ Accessible to screen readers and keyboard users

---

## **Implementation Checklist** 

### **Infrastructure** ✅ **COMPLETED**
- [x] Create `ContentEditModal` component
- [x] Create `EditButton` component  
- [x] Update `RichTextEditor` for HTML-only output
- [x] Add TypeScript interfaces
- [x] Test modal functionality

### **Content Integration** ✅ **COMPLETED**
- [x] Add edit button to content title (page header)
- [x] Add edit buttons to video script section
- [x] Add edit buttons to blog post fields (title, body, meta, URL)
- [x] Add edit buttons to email fields (subject, body)
- [x] Add edit buttons to YouTube fields (title, description)  
- [x] Add edit buttons to all social media content fields

### **Functionality** ✅ **COMPLETED**
- [x] Implement real-time UI updates (optimistic)
- [x] Add error handling within modal with retry button
- [x] Implement permission checks and disabled states
- [x] Add loading spinner on save button and disable modal during save
- [x] Disable edit buttons during save operations
- [x] Test all input types (text, textarea, HTML editor with links)

### **Testing & Polish** 🔄 **IN PROGRESS**
- [x] Test editing in all content sections
- [x] Test permission scenarios
- [x] Test error handling
- [ ] Test mobile responsiveness
- [ ] Performance testing with large content
- [ ] Accessibility testing

### **Documentation** ⏳ **PENDING**
- [ ] Component API documentation
- [ ] Implementation examples
- [ ] Testing procedures
- [ ] Performance benchmarks

---

**Total Implementation Time Estimate**: 3-5 days
**Priority**: High
**Dependencies**: Existing content display components, TipTap configuration
**Risk Level**: Low (leveraging existing patterns and components) 