# Phase 4: Social Integration Migration - ✅ COMPLETED + Facebook Page ID Integration

## **Overview**

This phase migrates social media integration (Upload-Post) from the separate `upload_post_profiles` table to a unified `social_integrations` table. This phase also implements the business name-based username generation and **Facebook Page ID integration for n8n workflows**.

## **Current State Analysis**

### **Current Implementation**
```sql
-- upload_post_profiles table (EXISTING AND WORKING)
CREATE TABLE upload_post_profiles (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    upload_post_username TEXT,
    social_accounts JSONB,
    facebook_page_id TEXT, -- NEW: Store Facebook Page ID for n8n integration
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE
);
```

### **Facebook Page ID Integration** 🆕
**NEW REQUIREMENT**: When users connect their social media profiles through Upload-Post, we need to:
1. ✅ Add `facebook_page_id` field to store the primary Facebook Page ID
2. ✅ Fetch Facebook Page ID using Upload-Post API after user connects Facebook
3. ✅ Store Facebook Page ID for use in n8n workflows
4. ✅ Only fetch if user has connected Facebook (conditional logic)

**API Integration**: Use Upload-Post Facebook Pages API
- **Endpoint**: `GET /api/uploadposts/facebook/pages?profile={username}`
- **Authentication**: `Authorization: ApiKey YOUR_API_KEY`
- **Response**: Array of Facebook pages with `page_id`, `page_name`, `profile`

### **Migration Conflict Resolution**
**DECISION MADE**: Keep existing `upload_post_profiles` table approach since it's working. Updated this phase to:
1. ✅ Enhanced the existing `upload_post_profiles` table with new username generation
2. ✅ Kept the separate table structure (better separation of concerns)
3. ✅ Updated username generation to use business names instead of "transformo"
4. 🆕 **Added Facebook Page ID field and integration workflow**

### **Username Generation Issue - ✅ RESOLVED**
Previously used: `transformo_${business_id}` 
**New implementation**: Use business name instead of "transformo"
**New format**: `{sanitized_business_name}_{last_8_digits_of_business_id}`

### **Existing Components (ALL WORKING)**
- `components/shared/settings/social-media-integration-wrapper.tsx` ✅
- `app/actions/upload-post.ts` ✅
- `app/api/upload-post/` routes ✅
- `lib/upload-post.ts` (username generation) ✅

## **Migration Plan (UPDATED WITH FACEBOOK PAGE ID)**

### **Step 1: Update Username Generation** ✅
Fixed the username generation to use business names while keeping existing table structure.

### **Step 2: Update Upload-Post Validation** ✅
Updated validation functions to accept new username format.

### **Step 3: Update Existing Components** ✅
Minimal updates to existing working components to use new username format.

### **Step 4: Database Function Updates** ✅
Added database function for username generation to maintain consistency.

### **Step 5: Facebook Page ID Integration** 🆕 **PENDING**
Add Facebook Page ID field and implement fetching/storing workflow.

**NEW TABLE CHANGES NEEDED**: Add `facebook_page_id` field to `upload_post_profiles` table

---

## **🤖 AI Implementation Checklist**

### **Phase 4.1: Database Schema Creation** ✅ COMPLETED

#### **Migration File Creation**
- [x] ✅ Generated Brisbane timestamp: `20250623190940`
- [x] ✅ Created migration file: `supabase/migrations/20250623190940_update-upload-post-username-format.sql`
- [x] ✅ Implemented complete migration script
- [x] ✅ Tested migration locally: `supabase db push --local`
- [x] ✅ Verified table creation and function works correctly

#### **Migration Script - ✅ IMPLEMENTED**
```sql
-- =================================================================
--          Upload-Post Username Format Migration
-- =================================================================
-- This migration updates the username generation for upload-post
-- to use business names instead of "transformo" prefix.
-- KEEPS existing upload_post_profiles table structure.
-- =================================================================

-- Step 1: Create username generation function
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_upload_post_username(
    p_business_name TEXT,
    p_business_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_sanitized_name TEXT;
    v_business_id_suffix TEXT;
    v_username TEXT;
BEGIN
    -- Sanitize business name: lowercase, replace spaces with underscores, remove special chars
    v_sanitized_name := lower(p_business_name);
    v_sanitized_name := regexp_replace(v_sanitized_name, '\s+', '_', 'g'); -- Replace spaces with underscores
    v_sanitized_name := regexp_replace(v_sanitized_name, '[^a-z0-9_]', '', 'g'); -- Remove non-alphanumeric except underscores
    
    -- Get last 8 characters of business ID (remove hyphens first)
    v_business_id_suffix := right(replace(p_business_id::text, '-', ''), 8);
    
    -- Combine sanitized business name with business ID suffix
    v_username := v_sanitized_name || '_' || v_business_id_suffix;
    
    -- Ensure minimum length (if business name is empty after sanitization, use fallback)
    IF length(v_sanitized_name) = 0 THEN
        v_username := 'business_' || v_business_id_suffix;
    END IF;
    
    RETURN v_username;
END;
$$;

COMMENT ON FUNCTION public.generate_upload_post_username(TEXT, UUID) IS 'Generate upload-post username from business name and ID';

-- Step 2: Update upload_post_profiles table comment
-- -----------------------------------------------------------------
COMMENT ON COLUMN public.upload_post_profiles.upload_post_username IS 'Username in upload-post system (format: {business_name_with_underscores}_{last_8_digits_of_business_id})';

-- Step 3: Grant permissions
-- -----------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.generate_upload_post_username(TEXT, UUID) TO authenticated, service_role;

-- No data migration needed in development environment
-- Existing upload_post_profiles table structure remains unchanged
-- New usernames will be generated using the new format going forward
```

### **Phase 4.2: Facebook Page ID Database Schema** 🆕 **REQUIRED**

#### **New Migration File for Facebook Page ID**
- [ ] 🆕 Generate Brisbane timestamp for new migration
- [ ] 🆕 Create migration file: `supabase/migrations/{timestamp}_add-facebook-page-id-to-upload-post-profiles.sql`
- [ ] 🆕 Add `facebook_page_id` field to `upload_post_profiles` table
- [ ] 🆕 Test migration locally: `supabase db push --local`

#### **Facebook Page ID Migration Script** 🆕 **REQUIRED**
```sql
-- =================================================================
--          Add Facebook Page ID to Upload Post Profiles
-- =================================================================
-- This migration adds facebook_page_id field to upload_post_profiles
-- table for storing Facebook Page IDs used in n8n workflows.
-- =================================================================

-- Step 1: Add facebook_page_id column
-- -----------------------------------------------------------------
ALTER TABLE public.upload_post_profiles 
ADD COLUMN facebook_page_id TEXT;

-- Step 2: Add comment explaining the field
-- -----------------------------------------------------------------
COMMENT ON COLUMN public.upload_post_profiles.facebook_page_id IS 'Primary Facebook Page ID for this profile, used in n8n workflows for Facebook posting';

-- Step 3: Add index for efficient lookups
-- -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_upload_post_profiles_facebook_page_id 
ON public.upload_post_profiles (facebook_page_id) 
WHERE facebook_page_id IS NOT NULL;

-- Step 4: Add constraint to ensure facebook_page_id format (optional)
-- -----------------------------------------------------------------
ALTER TABLE public.upload_post_profiles 
ADD CONSTRAINT chk_facebook_page_id_format 
CHECK (facebook_page_id IS NULL OR facebook_page_id ~ '^[0-9]+$');
```

### **Phase 4.3: Facebook Page ID API Integration** 🆕 **REQUIRED**

#### **Update Upload-Post Library**
- [ ] 🆕 Add `fetchFacebookPageId` function to `lib/upload-post.ts`
- [ ] 🆕 Add Facebook Page ID validation
- [ ] 🆕 Implement conditional Facebook Page fetching logic

**New Function Required:**
```typescript
// Add to lib/upload-post.ts
export async function fetchFacebookPageId(username: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.upload-post.com/api/uploadposts/facebook/pages?profile=${username}`, {
      headers: {
        'Authorization': `ApiKey ${process.env.UPLOAD_POST_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch Facebook pages for ${username}:`, response.status);
      return null;
    }

    const data = await response.json();
    
    // Return the first page ID if available
    if (data.success && data.pages && data.pages.length > 0) {
      return data.pages[0].page_id;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Facebook Page ID:', error);
    return null;
  }
}
```

#### **Update Upload-Post Actions**
- [ ] 🆕 Update `app/actions/upload-post.ts` to fetch and store Facebook Page ID
- [ ] 🆕 Add Facebook Page ID sync functionality
- [ ] 🆕 Implement conditional logic (only fetch if Facebook is connected)

**Action Update Required:**
```typescript
// Update syncUploadPostProfile function in app/actions/upload-post.ts
import { fetchFacebookPageId } from '@/lib/upload-post';

export async function syncUploadPostProfile(businessId: string) {
  // ... existing sync logic ...
  
  // Check if Facebook is connected before fetching Page ID
  const facebookAccount = profileData.social_accounts?.facebook;
  let facebookPageId = null;
  
  if (facebookAccount && typeof facebookAccount === 'object' && facebookAccount.username) {
    // User has connected Facebook, fetch Page ID
    facebookPageId = await fetchFacebookPageId(profile.upload_post_username);
  }
  
  // Update profile with Facebook Page ID
  if (facebookPageId) {
    await supabase
      .from('upload_post_profiles')
      .update({ 
        social_accounts: profileData.social_accounts,
        facebook_page_id: facebookPageId,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', profile.id);
  } else {
    // Update without Facebook Page ID
    await supabase
      .from('upload_post_profiles')
      .update({ 
        social_accounts: profileData.social_accounts,
        last_synced_at: new Date().toISOString()
      })
      .eq('id', profile.id);
  }
}
```

#### **Update Sync API Routes**
- [ ] 🆕 Update `app/api/upload-post/profiles/sync/route.ts` to handle Facebook Page ID
- [ ] 🆕 Add Facebook Page ID to profile sync response
- [ ] 🆕 Implement error handling for Facebook API failures

### **Phase 4.4: Component Updates for Facebook Page ID** 🆕 **REQUIRED**

#### **Update Social Media Integration Wrapper**
- [ ] 🆕 Update `components/shared/settings/social-media-integration-wrapper.tsx`
- [ ] 🆕 Display Facebook Page ID when available
- [ ] 🆕 Show Facebook Page ID sync status
- [ ] 🆕 Add refresh functionality for Facebook Page ID

**Component Update Required:**
```typescript
// Update social-media-integration-wrapper.tsx to show Facebook Page ID
{profile.facebook_page_id && (
  <div className="mt-2 text-sm text-muted-foreground">
    Facebook Page ID: {profile.facebook_page_id}
  </div>
)}
```

#### **Update Upload-Post Integration Flow**
- [ ] 🆕 Modify user return flow to trigger Facebook Page ID sync
- [ ] 🆕 Add loading state for Facebook Page ID fetching
- [ ] 🆕 Handle Facebook Page ID sync errors gracefully

### **Phase 4.5: Testing & Validation for Facebook Page ID** 🆕 **REQUIRED**

#### **Database Testing**
- [ ] 🆕 Test new migration: `supabase db push --local`
- [ ] 🆕 Verify `facebook_page_id` field added correctly
- [ ] 🆕 Test Facebook Page ID storage and retrieval
- [ ] 🆕 Validate Facebook Page ID format constraint

#### **API Integration Testing**
- [ ] 🆕 Test Facebook Pages API endpoint with Upload-Post credentials
- [ ] 🆕 Verify Facebook Page ID fetching for connected accounts
- [ ] 🆕 Test conditional logic (no fetch when Facebook not connected)
- [ ] 🆕 Test error handling for API failures

#### **End-to-End Testing**
- [ ] 🆕 Test user connects Facebook → Page ID fetched and stored
- [ ] 🆕 Test user without Facebook → No Page ID fetching attempted
- [ ] 🆕 Test Page ID display in settings UI
- [ ] 🆕 Test Page ID available for n8n workflows

#### **Integration Testing**
- [ ] 🆕 Verify Facebook Page ID available for n8n Facebook posting workflows
- [ ] 🆕 Test Page ID persistence across profile syncs
- [ ] 🆕 Verify Page ID updates when user changes Facebook connection

### **Phase 4.6: TypeScript Types Update** 🆕 **REQUIRED**

#### **Update Supabase Types**
- [ ] 🆕 Run: `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] 🆕 Verify `facebook_page_id` field in types
- [ ] 🆕 Update component TypeScript interfaces

#### **Update Upload-Post Types**
- [ ] 🆕 Add Facebook Page ID to upload-post profile interfaces
- [ ] 🆕 Update API response types
- [ ] 🆕 Add Facebook Pages API response types

**Type Updates Required:**
```typescript
// Update types/index.ts or relevant type file
interface UploadPostProfile {
  id: string;
  business_id: string;
  upload_post_username: string;
  social_accounts: any;
  facebook_page_id: string | null; // NEW
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
}

interface FacebookPage {
  page_id: string;
  page_name: string;
  profile: string;
}

interface FacebookPagesResponse {
  pages: FacebookPage[];
  success: boolean;
}
```

### **Phase 4.7: Final Validation for Facebook Page ID** 🆕 **REQUIRED**

#### **Complete Facebook Page ID Integration Test**
- [ ] 🆕 Database stores Facebook Page IDs correctly
- [ ] 🆕 API integration fetches Page IDs when Facebook connected
- [ ] 🆕 No API calls made when Facebook not connected
- [ ] 🆕 UI displays Facebook Page ID information
- [ ] 🆕 Page ID available for n8n workflow integration
- [ ] 🆕 Error handling works for API failures

#### **N8N Integration Readiness**
- [ ] 🆕 Facebook Page ID accessible from database for n8n workflows
- [ ] 🆕 Page ID format validated for Facebook API compatibility
- [ ] 🆕 Conditional logic prevents empty/null Page ID usage
- [ ] 🆕 Page ID updates when user reconnects Facebook

---

## **Migration Files Created**

1. **`20250623190940_update-upload-post-username-format.sql`** - Username format migration ✅
2. **`{new_timestamp}_add-facebook-page-id-to-upload-post-profiles.sql`** - Facebook Page ID field 🆕 **REQUIRED**

## **Success Criteria**

### **Phase 4 Complete:** ✅ ORIGINAL COMPLETED + 🆕 **FACEBOOK PAGE ID PENDING**
- [x] ✅ Database function created for business name-based username generation
- [x] ✅ Username generation uses business names instead of "transformo"
- [x] ✅ Username validation updated to accept new format
- [x] ✅ Social media integration components work with new structure
- [x] ✅ Upload-post platform integration works with new usernames
- [x] ✅ Existing `upload_post_profiles` table kept (working solution)
- [x] ✅ TypeScript types updated
- [x] ✅ All existing social media functionality preserved and improved
- [x] ✅ Performance maintained (no degradation)

### **Phase 4 - Facebook Page ID Integration:** 🆕 **REQUIRED FOR COMPLETION**
- [ ] 🆕 `facebook_page_id` field added to `upload_post_profiles` table
- [ ] 🆕 Facebook Pages API integration implemented
- [ ] 🆕 Conditional Facebook Page ID fetching (only when Facebook connected)
- [ ] 🆕 Facebook Page ID stored and displayed in UI
- [ ] 🆕 Page ID available for n8n Facebook posting workflows
- [ ] 🆕 Error handling for Facebook API failures
- [ ] 🆕 TypeScript types updated for Facebook Page ID

### **Ready for Phase 5:** ⏳ **PENDING FACEBOOK PAGE ID**
- [x] ✅ All original Phase 4 checklist items completed
- [ ] 🆕 Facebook Page ID integration completed
- [ ] 🆕 N8N workflows can access Facebook Page IDs
- [ ] 🆕 No errors in Facebook Page ID integration
- [ ] 🆕 Documentation updated with Facebook Page ID workflow

---

## **Facebook Page ID Integration Workflow** 🆕

### **User Journey:**
1. **User connects social accounts** via Upload-Post JWT URL
2. **User returns to app** after connecting accounts
3. **App syncs profile** using existing sync functionality
4. **Conditional Facebook check**: If Facebook is connected in `social_accounts`
5. **Fetch Facebook Page ID** using Upload-Post Facebook Pages API
6. **Store Page ID** in `upload_post_profiles.facebook_page_id` field
7. **Display in UI** and make available for n8n workflows

### **API Integration Details:**
- **Endpoint**: `GET https://api.upload-post.com/api/uploadposts/facebook/pages?profile={username}`
- **Authentication**: `Authorization: ApiKey {UPLOAD_POST_API_KEY}`
- **Response**: Array of Facebook pages with `page_id`, `page_name`, `profile`
- **Logic**: Store first page's `page_id` as primary Facebook Page ID

### **n8n Integration Usage:**
- Facebook Page ID available in `upload_post_profiles.facebook_page_id`
- Use for Facebook Page posting workflows
- Conditional logic: Only use if `facebook_page_id IS NOT NULL`
- Error handling: Fallback to user's personal Facebook if Page ID unavailable

### **Error Handling:**
- API failures: Log error, continue without Page ID
- No Facebook connection: Skip Page ID fetching entirely
- Multiple pages: Use first page as primary, could be enhanced later
- Page ID format: Validate numeric format in database constraint

---

**✅ Phase 4 Original Implementation Summary:**

**What Was Built:**
- Database function for business name-based username generation
- Updated username validation to remove "transformo" requirement
- Enhanced existing upload-post integration with business branding
- Seamless transition from generic to business-specific usernames

**🆕 What Needs to Be Built (Facebook Page ID):**
- Database field for storing Facebook Page IDs
- API integration to fetch Facebook Page IDs from Upload-Post
- Conditional logic to only fetch when Facebook is connected
- UI updates to display Facebook Page ID information
- n8n workflow integration support

**Key Improvements Achieved:**
- Usernames now reflect actual business names instead of generic "transformo" prefix
- Better branding for businesses using upload-post integration
- Maintained all existing functionality while improving user experience
- Proper sanitization ensures usernames are platform-compatible

**🆕 Key Improvements Pending (Facebook Page ID):**
- n8n workflows will have access to Facebook Page IDs for Facebook posting
- Improved Facebook integration with Page-specific posting capabilities
- Better error handling and conditional logic for Facebook features
- Enhanced user experience with visible Facebook Page information

**Migration Status**: ✅ **Original completed, 🆕 Facebook Page ID integration required** 