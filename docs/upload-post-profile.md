# Upload-Post Profile Integration PRD

## Overview

This document outlines the implementation of upload-post.com social media integration into the Transformo app. The integration will allow users to connect their social media accounts through upload-post and manage their profiles within the Transformo platform.

## 1. Feature Requirements

### 1.1 Core Functionality

- **Integrations Page**: New settings sub-page for managing all third-party integrations
- **Social Media Integration Card**: Visual interface showing connected/disconnected social media accounts
- **Upload-Post Profile Management**: Create and manage upload-post profiles for users
- **Real-time Sync**: Automatically sync social media connection status on page load
- **Secure API Key Storage**: Store upload-post API keys in Supabase vault

### 1.2 Social Media Platforms

Support for the following platforms with visual status indicators:
1. Facebook
2. Instagram  
3. X (Twitter)
4. YouTube
5. LinkedIn
6. TikTok

## 2. Architecture Changes

### 2.1 Navigation Structure Updates

**Current Structure:**
```
/settings (Business Settings)
```

**New Structure:**
```
Sidebar Navigation:
├── Content (/content)
├── New Content (/new)
└── Settings (collapsible menu)
    ├── Business Settings (/settings/business)
    └── Integrations (/settings/integrations)
```

**Implementation:**
- Collapsible Settings menu in sidebar navigation
- Auto-expands when user is on any settings page
- `/settings` redirects to `/settings/business` (default)
- No separate settings overview page needed

### 2.2 Database Schema Changes

#### 2.2.1 Update businesses table

```sql
-- Remove upload_post_id field entirely (no longer needed)
ALTER TABLE businesses 
DROP COLUMN IF EXISTS upload_post_id;
```

#### 2.2.2 Create upload_post_profiles table

```sql
CREATE TABLE upload_post_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    upload_post_username TEXT NOT NULL UNIQUE,
    social_accounts JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT unique_business_upload_post UNIQUE(business_id)
);

-- Note: upload_post_username stored as plain text (format: transformo_${business_id})
-- Note: Global API key stored in environment variables, not per-business

-- Add RLS policies
ALTER TABLE upload_post_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to access their business profiles
CREATE POLICY "Users can access their business upload_post_profiles" ON upload_post_profiles
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM profiles 
            WHERE id = auth.uid()
        )
    );
```

### 2.3 Environment Variables

Add to `.env.local`:
```env
# Upload-Post Integration
UPLOAD_POST_API_KEY=your_upload_post_api_key_here
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**Note**: Only ONE API key needed for entire Transformo account, not per business.

## 3. Component Structure

### 3.1 New Components

```
components/shared/settings/
├── integrations-page.tsx           # Main integrations page layout
├── social-media-integration-card.tsx  # Social media integration card
├── upload-post-connect-button.tsx     # Connect social media button
└── social-media-status-icons.tsx      # Social media platform icons with status

components/ui/
└── status-badge.tsx               # Reusable status badge component
```

### 3.2 Updated Components

```
app/(app)/settings/
├── page.tsx                       # Redirect to business settings (default)
├── business/
│   └── page.tsx                   # Business settings page
└── integrations/
    └── page.tsx                   # Integrations page

components/shared/
├── sidebar-nav.tsx                # New collapsible sidebar navigation
└── settings/
    ├── email-settings-form.tsx    # Moved to integrations
    └── heygen-settings-form.tsx   # Moved to integrations
```

## 4. API Integration

### 4.1 Upload-Post API Endpoints

#### 4.1.1 Get User Profiles
```typescript
GET https://api.upload-post.com/api/uploadposts/users
Headers: Authorization: ApiKey YOUR_API_KEY
Response: {
  limit: 10,
  plan: "default", 
  profiles: [{
    created_at: "2025-04-02T17:44:33.229755",
    social_accounts: {
      facebook: { display_name: "FB User", social_images: "url", username: "fb_user_id" },
      instagram: { display_name: "IG User", social_images: "url", username: "ig_username" }
    },
    username: "transformo_123"
  }],
  success: true
}
```

#### 4.1.2 Create User Profile
```typescript
POST https://api.upload-post.com/api/uploadposts/users
Headers: Authorization: ApiKey YOUR_API_KEY
Body: { username: "transformo_${business_id}" }
Response: {
  success: true,
  profile: {
    username: "transformo_123",
    created_at: "timestamp"
  }
}
```

#### 4.1.3 Generate JWT URL
```typescript
POST https://api.upload-post.com/api/uploadposts/users/generate-jwt
Headers: Authorization: ApiKey YOUR_API_KEY
Body: {
  username: "transformo_${business_id}",
  redirect_url: "${NEXT_PUBLIC_BASE_URL}/settings/integrations?connected=true",
  logo_image: "${NEXT_PUBLIC_BASE_URL}/transformo-logo.webp",
  redirect_button_text: "Return to Transformo",
  platforms: ["facebook", "instagram", "x", "youtube", "linkedin", "tiktok"]
}
Response: {
  success: true,
  access_url: "https://upload-post.com/connect/jwt_token_here"
}
```

### 4.2 Internal API Routes

#### 4.2.1 Upload-Post Settings Management
```
app/api/upload-post/
├── settings/
│   ├── route.ts               # GET/POST upload-post settings
│   └── remove-key/
│       └── route.ts           # DELETE upload-post API key
├── profiles/
│   ├── route.ts               # GET/POST user profiles
│   └── sync/
│       └── route.ts           # POST sync social accounts
└── connect/
    └── route.ts               # POST generate connection URL
```

## 5. User Experience Flow

### 5.1 Settings Navigation Flow

1. User clicks "Settings" in sidebar navigation
2. Settings menu expands to show sub-items:
   - Business Settings
   - Integrations
3. User clicks desired sub-item to navigate directly to that page
4. Active state highlights current page in the sidebar

### 5.2 Social Media Connection Flow

1. User visits `/settings/integrations`
2. Social Media Integration card shows:
   - Upload-Post API key status (configured/not configured)
   - 6 social media platform icons (grayed out if not connected)
   - "Connect Social Media" button
3. User clicks "Connect Social Media":
   - If no API key: Show error message
   - If API key exists: Generate JWT URL and redirect to upload-post
4. User connects accounts on upload-post platform
5. User returns to Transformo via redirect URL
6. Page automatically syncs and updates icon status

### 5.3 Icon Status Design

**Disconnected State:**
- Icon: Grayed out (text-muted-foreground)
- Text: Platform name in muted text
- Badge: "Not Connected" (secondary variant)

**Connected State:**
- Icon: Full color (brand colors)
- Text: Platform name + display name
- Badge: "Connected" (default variant)

## 6. Technical Implementation Details

### 6.1 Social Accounts Data Structure

```typescript
interface SocialAccount {
  display_name: string;
  social_images: string;
  username: string;
}

interface SocialAccounts {
  facebook?: SocialAccount | "";
  instagram?: SocialAccount | "";
  x?: SocialAccount | "";
  youtube?: SocialAccount | "";
  linkedin?: SocialAccount | "";
  tiktok?: SocialAccount | "";
}
```

### 6.2 Upload-Post Profile Username Strategy

**Format**: `transformo_${business.id}`
**Example**: `transformo_123e4567-e89b-12d3-a456-426614174000`

**Purpose of `transformo_` prefix**:
- **Source identification**: Upload-post can identify these users came from Transformo
- **Namespace separation**: Prevents conflicts with other platforms using upload-post
- **Debugging**: Easier to identify Transformo users in upload-post's system

**Benefits**: 
- Easy lookup and collision-free (UUIDs are globally unique)
- Clear ownership and source identification
- Shorter than full `transformo_business_` prefix

### 6.3 Error Handling Strategy

1. **API Key Missing**: Show setup instructions with clear error message
2. **Upload-Post API Unavailable**: Show cached data with warning banner
3. **Profile Creation Failure**: Show error toast with retry option
4. **Sync Failure**: Show last sync time with manual refresh button
5. **Connection Flow Interruption**: Graceful redirect with status message

### 6.4 Security Considerations

- Store API keys in Supabase vault (encrypted)
- Use business_id for RLS policies
- Validate JWT tokens on redirect
- Sanitize all upload-post API responses
- Implement rate limiting on sync endpoints

## 7. Component Design Patterns

### 7.1 Following Existing Patterns

Based on existing codebase analysis:

**Card Structure:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Integration Name</CardTitle>
    <CardDescription>Description text</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Form or content */}
  </CardContent>
  <CardFooter className="border-t px-6 py-4">
    <Button>Action Button</Button>
  </CardFooter>
</Card>
```

**Form Pattern:**
- Use `react-hook-form` with `zod` validation
- Follow existing form field patterns
- Use `toast` for success/error notifications
- Include loading states with disabled buttons

**Icon Usage:**
- Use Lucide React icons consistently
- Follow existing size patterns (h-4 w-4, h-5 w-5)
- Use existing color classes for states

## 8. Migration Strategy

### 8.1 Database Migration Order

1. Rename `upload_post_id` to `upload_post_secret_id`
2. Create `upload_post_profiles` table
3. Update TypeScript types
4. Migrate existing upload_post_id values if any

### 8.2 Component Migration

1. Move email and heygen settings to integrations page
2. Create new settings navigation structure
3. Update all internal links
4. Test navigation flows



## 10. Implementation Phases

### Phase 1: Database Foundation ✅ COMPLETED
**Goal**: Set up database schema and types for upload-post integration

**Deliverables**:
- [x] Create migration file: `supabase/migrations/20250612195458_remove-upload-post-id-field.sql`
  ```sql
  -- Remove upload_post_id field entirely (no longer needed)
  ALTER TABLE businesses 
  DROP COLUMN IF EXISTS upload_post_id;
  ```

- [x] Create migration file: `supabase/migrations/20250612195512_create-upload-post-profiles-table.sql`
  ```sql
  CREATE TABLE upload_post_profiles (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      upload_post_username TEXT NOT NULL UNIQUE,
      social_accounts JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_synced_at TIMESTAMP WITH TIME ZONE,
      
      CONSTRAINT unique_business_upload_post UNIQUE(business_id)
  );
  
  ALTER TABLE upload_post_profiles ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Users can access their business upload_post_profiles" ON upload_post_profiles
      FOR ALL USING (
          business_id IN (
              SELECT business_id FROM profiles 
              WHERE id = auth.uid()
          )
      );
  ```

- [x] Update `types/supabase.ts` to reflect schema changes (regenerate types with `npx supabase gen types typescript`)
- [x] Run migrations: `supabase db push`

**Validation**: ✅ Database has new table, upload_post_id field removed from businesses table, TypeScript types are updated

---

### Phase 2: Settings Navigation Restructure ✅ COMPLETED
**Goal**: Implement collapsible sidebar navigation for settings

**Deliverables**:
- [x] Create new sidebar navigation component: `components/shared/sidebar-nav.tsx`
  - Client-side component with collapsible Settings menu
  - Auto-expands when user is on any settings page
  - Uses Lucide React icons and proper hover states
  - Manages active state detection with usePathname

- [x] Create business settings sub-page: `app/(app)/settings/business/page.tsx`
  - Move ALL existing business settings content from current `/settings` page
  - Should be identical to current settings page functionality

- [x] Create integrations sub-page structure: `app/(app)/settings/integrations/page.tsx`
  - Basic page structure with placeholder for integrations
  - Use same layout patterns as business settings

- [x] Update app layout in `app/(app)/layout.tsx`
  - Replace hardcoded navigation with new SidebarNav component
  - Remove old navigation structure

- [x] Create settings redirect page: `app/(app)/settings/page.tsx`
  - Redirects `/settings` to `/settings/business` as default

**Validation**: ✅ Collapsible navigation works, all settings pages accessible, business settings functionality preserved

---

### Phase 3: Move Email & HeyGen to Integrations ✅ COMPLETED
**Goal**: Relocate existing integrations to new integrations page

**Deliverables**:
- [x] Move `EmailSettingsForm` and `HeygenSettingsForm` from business settings to integrations page
- [x] Update `app/(app)/settings/integrations/page.tsx`:
  ```tsx
  import { EmailSettingsForm } from '@/components/shared/settings/email-settings-form';
  import { HeygenSettingsForm } from '@/components/shared/settings/heygen-settings-form';
  
  // Include both forms in Card components following existing patterns
  ```

- [x] Remove email and heygen sections from `app/(app)/settings/business/page.tsx` (they were never there)
- [x] **Update `social-media-form.tsx`**: Remove the upload_post_id field since it's being replaced by the new integration system
- [x] Test that all existing functionality works in new location

**Validation**: ✅ Email and HeyGen settings work correctly on integrations page, removed from business page, ✅ upload_post_id field removed from social media form

---

### Phase 4: Upload-Post API Foundation ✅ COMPLETED
**Goal**: Set up basic upload-post API integration and utilities

**Deliverables**:
- [x] Create upload-post API client utility: `lib/upload-post.ts`
  ```typescript
  // Functions implemented:
  // - getUserProfiles() - uses global API key from env
  // - createUserProfile(username: string) - uses global API key from env
  // - generateJWTUrl(username: string, options) - uses global API key from env
  // - findProfileByUsername(username: string) - helper function
  // - testConnection() - API key validation
  ```

- [x] Create API route: `app/api/upload-post/profiles/route.ts`
  - GET: Retrieve user's upload-post profile and social accounts with auto-sync
  - POST: Create new upload-post profile using transformo_${business_id} format

- [x] Create API route: `app/api/upload-post/connect/route.ts`
  - POST: Generate JWT URL for social media connection with custom options

- [x] Verify environment variable `UPLOAD_POST_API_KEY` is accessible in API routes
- [x] Create server actions: `app/actions/upload-post.ts` following existing patterns
  - testUploadPostConnection()
  - getUploadPostProfile() 
  - createUploadPostProfile()
  - generateSocialMediaConnectionUrl()
  - syncSocialMediaAccounts()

**Validation**: ✅ API routes respond correctly (401 Unauthorized for unauthenticated requests), upload-post integration ready

---

### Phase 5: Upload-Post Connection Status ✅ COMPLETED → UPDATED
**Goal**: ~~Create upload-post connection status interface~~ **REMOVED - API key is platform-level, not user-facing**

**Updated Understanding**:
- Upload-Post API key is a **platform-level configuration** in `.env.local`
- This is the **Transformo app's API key**, not something end users manage
- Only ONE API key for the entire platform - managed by developers/admins
- End users should not see API key status or configuration

**Deliverables**:
- [x] ~~Create `components/shared/settings/upload-post-status-card.tsx`~~ **REMOVED**
- [x] ~~Add `UploadPostStatusCard` to integrations page~~ **REMOVED**  
- [x] Environment variable integration (`UPLOAD_POST_API_KEY` in `.env.local`)
- [x] API key validation in backend functions (for internal use)

**Validation**: ✅ Upload-Post API integration works behind the scenes, no user-facing API key management needed

---

### Phase 6: Social Media Integration Card - Basic Structure ✅ COMPLETED
**Goal**: Create the visual social media integration interface

**Deliverables**:
- [x] Create `components/shared/settings/social-media-integration-card.tsx`
  - Card layout with title "Social Media Integration" and Share2 icon
  - Connected platforms counter badge (0/6 Connected by default)
  - "Connect Social Media" button (enabled for all users)
  - ~~Warning message when API key not configured~~ **REMOVED**
  - Loading states with spinner animation
  - Full-width button with proper sizing

- [x] Create `components/shared/settings/social-media-status-icons.tsx`
  - Grid of 6 platform icons using Lucide React:
    * Facebook (blue), Instagram (pink), X/Twitter (sky), YouTube (red), LinkedIn (blue), TikTok/Music (black)
  - Grayed out state by default with "Not Connected" badges
  - Connected state with colors, display names, and "Connected" badges
  - Responsive grid (2 cols mobile, 3 cols desktop)
  - Proper type safety with TypeScript interfaces

- [x] Add social media card to integrations page
- [x] Style according to existing Card patterns

**Validation**: ✅ Social media card displays with all 6 icons in grayed-out state

---

### Phase 7: Upload-Post Profile Management ✅ COMPLETED
**Goal**: Implement upload-post profile creation and management

**Deliverables**:
- [x] Create API route: `app/api/upload-post/profiles/route.ts` **COMPLETED IN PHASE 4**
  - GET: Retrieve user's upload-post profile and social accounts
  - POST: Create new upload-post profile

- [x] Create API route: `app/api/upload-post/connect/route.ts` **COMPLETED IN PHASE 4**
  - POST: Generate JWT URL for social media connection

- [x] Implement profile creation logic using business ID format: `transformo_${business.id}` **COMPLETED IN PHASE 4**
- [x] Add profile status checking to social media card **READY FOR PHASE 8**

**Validation**: ✅ Can create upload-post profiles and check their status

---

### Phase 8: Social Media Connection Flow ✅ COMPLETED
**Goal**: Enable users to connect social media accounts through upload-post

**Deliverables**:
- [x] Create `components/shared/settings/social-media-integration-wrapper.tsx` **CLIENT COMPONENT WRAPPER**
  - **Check for existing profile**: On button click, first check if upload-post profile exists in database
  - **Create profile if needed**: If no profile exists, create one using `transformo_${business.id}` format
  - **Generate JWT URL**: Only after profile exists, generate JWT URL for connection
  - Shows appropriate error states for profile creation failures
  - Loading state during profile creation and URL generation

- [x] Implement connect button logic flow:
  ```typescript
  const handleConnect = async () => {
    try {
      // 1. Check if upload-post profile exists
      const profileResult = await getUploadPostProfile();
      
      // 2. Create profile if it doesn't exist
      if (!profileResult.data) {
        const createResult = await createUploadPostProfile();
        if (!createResult.data) {
          throw new Error(createResult.error || 'Failed to create profile');
        }
      }
      
      // 3. Generate JWT URL and redirect
      const jwtResult = await generateSocialMediaConnectionUrl();
      window.location.href = jwtResult.data.access_url;
    } catch (error) {
      // Handle errors appropriately
    }
  };
  ```

- [x] **Handle return flow from upload-post platform**:
  - Check for `?connected=true` query parameter on integrations page
  - If present, automatically trigger a sync to refresh social media status
  - Show success toast: "Social media accounts connected successfully"
  - Remove query parameter from URL after processing

- [x] Add proper error handling for both profile creation and connection failures
- [x] Update integrations page to use wrapper component instead of placeholder

**Validation**: ✅ Users can click connect button, profile is created if needed, then redirected to upload-post platform, and return flow triggers automatic sync

---

### Phase 9: Social Accounts Sync ✅ COMPLETED
**Goal**: Sync connected social media accounts from upload-post

**Deliverables**:
- [x] Create API route: `app/api/upload-post/profiles/sync/route.ts`
  - POST: Sync social accounts from upload-post API
  - Update local database with current connection status
  - Includes rate limiting (1 minute cache) to prevent excessive API calls
  - Returns cached data if recently synced

- [x] Implement automatic sync on page load
  - Auto-syncs if data is older than 5 minutes or never synced
  - Silent background sync doesn't interrupt user experience
  - Smart caching to avoid unnecessary API calls

- [x] Update social media icons to show connected state with profile info
  - Icons show brand colors when connected, gray when disconnected
  - Display names and usernames shown for connected accounts
  - Proper badges indicating connection status

- [x] Add last sync timestamp display
  - Shows "Last synced: [timestamp]" in readable format
  - Manual refresh button with spinning icon during sync
  - Refresh button appears next to timestamp

**Additional Features Implemented**:
- [x] Manual refresh functionality with dedicated button
- [x] Silent sync capability for background operations
- [x] Smart sync frequency management (5-minute threshold)
- [x] Rate limiting on API route (1-minute cache)
- [x] Proper loading states and error handling
- [x] Toast notifications for user feedback

**Validation**: ✅ Social media icons update to show connected/disconnected status, automatic background sync, manual refresh capability

---

### Phase 10: UI Polish & Error Handling ✅ COMPLETED
**Goal**: Improve user experience with proper loading states and error handling

**Deliverables**:
- [x] Add loading states to all async operations
  - Enhanced loading skeleton with detailed card structure
  - Loading animations for refresh button and connection process
  - Comprehensive skeleton matching actual component layout

- [x] Implement proper error boundaries for upload-post features
  - Created `ErrorBoundary` component with React error boundary pattern
  - Graceful error handling with retry functionality
  - Development mode error details for debugging
  - Applied to social media integration wrapper

- [x] Add responsive design for all new components
  - Grid responsive layouts (2 cols mobile, 3 cols desktop)
  - Hover effects and smooth transitions
  - Mobile-optimized spacing and sizing

- [x] Style connected social media icons with proper colors
  - Brand-accurate colors for each platform
  - Enhanced hover effects with scale animations
  - Proper contrast and accessibility considerations

- [x] Add tooltips or additional info for social media accounts
  - ShadCN Tooltip component integration
  - Contextual information for connected/disconnected states
  - Helpful guidance text for connection process

- [x] Implement proper form validation and error messages
  - Custom error types: `UploadPostError`, `UploadPostAuthError`, `UploadPostRateLimitError`, `UploadPostValidationError`
  - Enhanced error handling in upload-post library
  - User-friendly error messages based on error type
  - Specific error handling for API authentication, rate limiting, and validation

**Additional Features Implemented**:
- [x] Enhanced error messaging system with context-aware messages
- [x] Improved loading skeleton with realistic component structure
- [x] Better hover states and micro-interactions
- [x] Comprehensive error boundary with retry mechanism
- [x] Professional tooltip system with helpful guidance

**Validation**: ✅ All components handle loading and error states gracefully with professional UI polish

---

### Phase 11: Security & Validation ✅
**Goal**: Ensure secure implementation with proper validation

**Deliverables**:
- [x] Add proper authentication checks to all API routes
- [x] Implement input validation and sanitization
- [x] Add rate limiting where appropriate
- [x] ~~Secure API key storage in Supabase vault~~ (Not needed - platform-level API key)
- [x] Validate JWT tokens on redirect
- [x] Add proper RLS policy testing

**Security Features Implemented**:
- [x] **Comprehensive Input Validation**: Zod schemas for all data validation with custom error types
- [x] **Enhanced API Route Security**: Authentication checks, rate limiting, and proper error handling
- [x] **JWT Redirect Validation**: Timestamp-based replay attack prevention with 1-hour expiry
- [x] **Request Rate Limiting**: Tiered limits (profiles: 30/min, creation: 5/5min, JWT: 10/5min, sync: 20/min)
- [x] **Data Sanitization**: XSS prevention, JSON validation, and safe data handling
- [x] **Security Headers**: Content-Type, Frame-Options, XSS-Protection, Referrer-Policy
- [x] **Retry Logic**: Exponential backoff with jitter for failed API calls
- [x] **URL Validation**: HTTPS enforcement, domain validation, path validation
- [x] **Error Handling**: Specific error types with proper HTTP status codes
- [x] **Database Security**: RLS policies enforced, UUID validation, business_id verification

**Validation**: ✅ Security review complete, comprehensive protection implemented

---

## Phase Dependencies

```
Phase 1 (Database) 
    ↓
Phase 2 (Navigation) 
    ↓
Phase 3 (Move Existing) 
    ↓
Phase 4 (API Foundation) 
    ↓
Phase 5 (Settings Form) 
    ↓
Phase 6 (Basic UI) 
    ↓
Phase 7 (Profile Management) 
    ↓
Phase 8 (Connection Flow) 
    ↓
Phase 9 (Sync) 
    ↓
Phase 10 (Polish) 
    ↓
Phase 11 (Security)
```

## Implementation Notes for AI

1. **Follow Existing Patterns**: Each phase should use the same patterns found in existing components (especially HeyGen integration)
2. **Test Each Phase**: Ensure each phase works before moving to the next
3. **Maintain Functionality**: Never break existing features while implementing new ones
4. **Use Existing Components**: Leverage existing UI components (Card, Button, Form, etc.)
5. **Brisbane Timezone**: Use Brisbane timezone for migration timestamps

## 12. Missing Implementation Details

### 12.1 Upload-Post API Error Handling

**Common Error Responses to Handle**:
```typescript
// 401 Unauthorized - Invalid API Key
{ success: false, error: "Invalid API key" }

// 400 Bad Request - Username already exists
{ success: false, error: "Username already taken" }

// 429 Rate Limited
{ success: false, error: "Rate limit exceeded" }

// 500 Server Error
{ success: false, error: "Internal server error" }
```

**Implementation**: Add specific error handling in `lib/upload-post.ts` for each error type

### 12.2 Environment Variables Required

Add to `.env.local`:
```env
# Upload-Post Integration (ONE API key for entire Transformo account)
UPLOAD_POST_API_KEY=your_upload_post_api_key_here
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**Important**: Only one API key needed for all businesses/users on the Transformo platform.

### 12.3 Redirect URL Handling

**Complete redirect URL format**:
```
${NEXT_PUBLIC_BASE_URL}/settings/integrations?connected=true&timestamp=${Date.now()}
```

The timestamp prevents caching issues when users return from upload-post.

### 12.4 Sync Frequency and Caching

**Implementation Strategy**:
- Sync on page load (if last sync > 5 minutes ago)
- Cache social accounts data in database
- Show "Last synced: X minutes ago" in UI
- Add manual "Refresh" button for immediate sync

### 12.5 Username Collision Handling

**Strategy**: Since using `transformo_${business_id}`, collisions should not occur. However:
- Add retry logic with incremental suffix if needed: `transformo_${business_id}_1`
- Log any collision attempts for monitoring

### 12.6 Disconnection Handling

**When users disconnect accounts on upload-post**:
- Regular sync will detect missing connections
- Update local database to reflect disconnected state
- Show icons in grayed-out state
- No action needed in Transformo UI - sync handles it automatically

### 12.7 Rate Limiting Strategy

**Implementation**:
- Limit sync calls to once per 60 seconds per business
- Implement exponential backoff for failed API calls
- Cache API responses for 5 minutes
- Add rate limiting headers handling

### 12.8 Security Considerations

**JWT Token Handling**:
- JWT tokens from upload-post are short-lived (typically 1-2 hours)
- Do NOT store JWT tokens - they're only for the connection flow
- Only store business API keys in Supabase vault
- Validate redirect URLs to prevent open redirect attacks

### 12.9 Development vs Production URLs

**Environment-specific handling**:
```typescript
const getRedirectUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/settings/integrations?connected=true`;
};
```

### 12.10 Monitoring and Logging

**Add logging for**:
- Upload-post API calls (success/failure)
- Profile creation attempts
- Sync operations
- Connection flow completions
- API key changes


## 11. Technical Notes

### 11.1 Upload-Post Username Strategy

**Decision**: Use `transformo_${business_id}` format
- Ensures uniqueness across platform
- Makes profile lookup straightforward
- Avoids user-level complications in multi-user businesses
- Maintains clear business-to-profile relationship

### 11.2 Social Media Platform Icons

Using Lucide React icons:
- Facebook: `Facebook`
- Instagram: `Instagram` 
- X (Twitter): `x`
- YouTube: `Youtube`
- LinkedIn: `Linkedin`
- TikTok: `Music` (closest available) or custom SVG

### 11.3 State Management

Following existing patterns:
- Use React state for UI state
- Server state via API calls
- Form state via react-hook-form
- Optimistic updates where appropriate

### 11.4 Performance Considerations

- Cache social media status data
- Implement proper loading states
- Use React.memo for static components
- Debounce sync operations

## 12. Future Enhancements

### 12.1 Advanced Features
- Bulk social media posting through upload-post
- Analytics integration from connected accounts
- Scheduled posting management
- Content performance tracking

### 12.2 UI Improvements
- Social media account preview cards
- Connection health monitoring
- Advanced sync settings
- Integration activity logs

This PRD provides a comprehensive roadmap for implementing the upload-post profile integration while maintaining consistency with the existing Transformo application architecture and design patterns. 