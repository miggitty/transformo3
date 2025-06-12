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
3. Twitter
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
/settings (Settings Overview/Landing)
├── /settings/business (Business Settings)
└── /settings/integrations (Integrations)
```

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
├── page.tsx                       # Settings overview/landing page
├── business/
│   └── page.tsx                   # Moved business settings
└── integrations/
    └── page.tsx                   # New integrations page

components/shared/settings/
├── email-settings-form.tsx        # Move to integrations
└── heygen-settings-form.tsx       # Move to integrations
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
  platforms: ["facebook", "instagram", "twitter", "youtube", "linkedin", "tiktok"]
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

1. User navigates to `/settings`
2. Settings overview page shows cards for:
   - Business Settings
   - Integrations
3. User clicks "Integrations" → Navigate to `/settings/integrations`

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
  twitter?: SocialAccount | "";
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

### Phase 1: Database Foundation
**Goal**: Set up database schema and types for upload-post integration

**Deliverables**:
- [ ] Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_remove-upload-post-id-field.sql`
  ```sql
  -- Remove upload_post_id field entirely (no longer needed)
  ALTER TABLE businesses 
  DROP COLUMN IF EXISTS upload_post_id;
  ```

- [ ] Create migration file: `supabase/migrations/YYYYMMDDHHMMSS_create-upload-post-profiles-table.sql`
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

- [ ] Update `types/supabase.ts` to reflect schema changes (regenerate types with `npx supabase gen types typescript`)
- [ ] Run migrations: `supabase db push`

**Validation**: Database has new table, upload_post_id field removed from businesses table, TypeScript types are updated

---

### Phase 2: Settings Navigation Restructure
**Goal**: Reorganize settings into sub-pages structure

**Deliverables**:
- [ ] Create new settings overview page: `app/(app)/settings/page.tsx`
  - Should show cards for "Business Settings" and "Integrations"
  - Use existing Card components from the codebase
  - Include navigation links to sub-pages

- [ ] Create business settings sub-page: `app/(app)/settings/business/page.tsx`
  - Move ALL existing business settings content from current `/settings` page
  - Should be identical to current settings page functionality

- [ ] Create integrations sub-page structure: `app/(app)/settings/integrations/page.tsx`
  - Basic page structure with placeholder for integrations
  - Use same layout patterns as business settings

- [ ] Update sidebar navigation in `app/(app)/layout.tsx`
  - Settings link should still point to `/settings` (now overview page)

**Validation**: All three pages render correctly, navigation works, business settings functionality preserved

---

### Phase 3: Move Email & HeyGen to Integrations
**Goal**: Relocate existing integrations to new integrations page

**Deliverables**:
- [ ] Move `EmailSettingsForm` and `HeygenSettingsForm` from business settings to integrations page
- [ ] Update `app/(app)/settings/integrations/page.tsx`:
  ```tsx
  import { EmailSettingsForm } from '@/components/shared/settings/email-settings-form';
  import { HeygenSettingsForm } from '@/components/shared/settings/heygen-settings-form';
  
  // Include both forms in Card components following existing patterns
  ```

- [ ] Remove email and heygen sections from `app/(app)/settings/business/page.tsx`
- [ ] **Update `social-media-form.tsx`**: Remove the upload_post_id field since it's being replaced by the new integration system
- [ ] Test that all existing functionality works in new location

**Validation**: Email and HeyGen settings work correctly on integrations page, removed from business page, upload_post_id field removed from social media form

---

### Phase 4: Upload-Post API Foundation
**Goal**: Set up basic upload-post API integration and utilities

**Deliverables**:
- [ ] Create upload-post API client utility: `lib/upload-post.ts`
  ```typescript
  // Functions for:
  // - getUserProfiles() - uses global API key from env
  // - createUserProfile(username: string) - uses global API key from env
  // - generateJWTUrl(username: string, options) - uses global API key from env
  // - No API key management needed (global key in env)
  ```

- [ ] Create API route: `app/api/upload-post/profiles/route.ts`
  - GET: Retrieve user's upload-post profile and social accounts
  - POST: Create new upload-post profile (uses env API key)

- [ ] Create API route: `app/api/upload-post/connect/route.ts`
  - POST: Generate JWT URL for social media connection (uses env API key)

- [ ] Verify environment variable `UPLOAD_POST_API_KEY` is accessible in API routes
- [ ] Create server actions: `app/actions/upload-post.ts` following existing patterns

**Validation**: API routes respond correctly using global API key from environment

---

### Phase 5: Upload-Post Connection Status
**Goal**: Create upload-post connection status interface

**Deliverables**:
- [ ] Create `components/shared/settings/upload-post-status-card.tsx`
  - Shows "Upload-Post Integration" status
  - Display: "API Key: Configured" or "API Key: Not Found" (read from env)
  - No form needed - API key is in environment variables
  - Add "Test Connection" button to verify API key works

- [ ] Add `UploadPostStatusCard` to integrations page  
- [ ] Add proper error handling for API key validation
- [ ] Include loading states for connection testing

**Validation**: Can see upload-post API key status and test connection

---

### Phase 6: Social Media Integration Card - Basic Structure
**Goal**: Create the visual social media integration interface

**Deliverables**:
- [ ] Create `components/shared/settings/social-media-integration-card.tsx`
  - Card layout with title "Social Media Integration"
  - Placeholder for 6 social media icons
  - "Connect Social Media" button (disabled if no API key)

- [ ] Create `components/shared/settings/social-media-status-icons.tsx`
  - Grid of 6 platform icons using Lucide React:
    * Facebook, Instagram, Twitter, Youtube, Linkedin, Music (for TikTok)
  - Grayed out state by default
  - Connected state with colors and display names

- [ ] Add social media card to integrations page
- [ ] Style according to existing Card patterns

**Validation**: Social media card displays with all 6 icons in grayed-out state

---

### Phase 7: Upload-Post Profile Management
**Goal**: Implement upload-post profile creation and management

**Deliverables**:
- [ ] Create API route: `app/api/upload-post/profiles/route.ts`
  - GET: Retrieve user's upload-post profile and social accounts
  - POST: Create new upload-post profile

- [ ] Create API route: `app/api/upload-post/connect/route.ts`
  - POST: Generate JWT URL for social media connection

- [ ] Implement profile creation logic using business ID format: `transformo_${business.id}`
- [ ] Add profile status checking to social media card

**Validation**: Can create upload-post profiles and check their status

---

### Phase 8: Social Media Connection Flow
**Goal**: Enable users to connect social media accounts through upload-post

**Deliverables**:
- [ ] Create `components/shared/settings/upload-post-connect-button.tsx`
  - **Check for existing profile**: On button click, first check if upload-post profile exists in database
  - **Create profile if needed**: If no profile exists, create one using `transformo_${business.id}` format
  - **Generate JWT URL**: Only after profile exists, generate JWT URL for connection
  - Shows appropriate error states for profile creation failures
  - Loading state during profile creation and URL generation

- [ ] Implement connect button logic flow:
  ```typescript
  const handleConnect = async () => {
    setLoading(true);
    try {
      // 1. Check if upload-post profile exists
      let profile = await getUploadPostProfile(businessId);
      
      // 2. Create profile if it doesn't exist
      if (!profile) {
        profile = await createUploadPostProfile(businessId);
      }
      
      // 3. Generate JWT URL and redirect
      const jwtUrl = await generateJWTUrl(profile.upload_post_username);
      window.location.href = jwtUrl;
    } catch (error) {
      // Handle errors appropriately
    } finally {
      setLoading(false);
    }
  };
  ```

- [ ] **Handle return flow from upload-post platform**:
  - Check for `?connected=true` query parameter on integrations page
  - If present, automatically trigger a sync to refresh social media status
  - Show success toast: "Social media accounts connected successfully"
  - Remove query parameter from URL after processing

- [ ] Add proper error handling for both profile creation and connection failures

**Validation**: Users can click connect button, profile is created if needed, then redirected to upload-post platform, and return flow triggers automatic sync

---

### Phase 9: Social Accounts Sync
**Goal**: Sync connected social media accounts from upload-post

**Deliverables**:
- [ ] Create API route: `app/api/upload-post/profiles/sync/route.ts`
  - POST: Sync social accounts from upload-post API
  - Update local database with current connection status

- [ ] Implement automatic sync on page load
- [ ] Update social media icons to show connected state with profile info
- [ ] Add last sync timestamp display

**Validation**: Social media icons update to show connected/disconnected status

---

### Phase 10: UI Polish & Error Handling
**Goal**: Improve user experience with proper loading states and error handling

**Deliverables**:
- [ ] Add loading states to all async operations
- [ ] Implement proper error boundaries for upload-post features
- [ ] Add responsive design for all new components
- [ ] Style connected social media icons with proper colors
- [ ] Add tooltips or additional info for social media accounts
- [ ] Implement proper form validation and error messages

**Validation**: All components handle loading and error states gracefully

---

### Phase 11: Security & Validation
**Goal**: Ensure secure implementation with proper validation

**Deliverables**:
- [ ] Add proper authentication checks to all API routes
- [ ] Implement input validation and sanitization
- [ ] Add rate limiting where appropriate
- [ ] Secure API key storage in Supabase vault
- [ ] Validate JWT tokens on redirect
- [ ] Add proper RLS policy testing

**Validation**: Security review passes, no sensitive data exposed

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
- Twitter: `Twitter`
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