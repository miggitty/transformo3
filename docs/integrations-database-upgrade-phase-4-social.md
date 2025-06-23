# Phase 4: Social Integration Migration

## **Overview**

This phase migrates social media integration (Upload-Post) from the separate `upload_post_profiles` table to a unified `social_integrations` table. This phase also implements the business name-based username generation as requested.

## **Current State Analysis**

### **Current Implementation**
```sql
-- upload_post_profiles table (EXISTING AND WORKING)
CREATE TABLE upload_post_profiles (
    id UUID PRIMARY KEY,
    business_id UUID REFERENCES businesses(id),
    upload_post_username TEXT,
    social_accounts JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE
);
```

### **Migration Conflict Resolution**
**IMPORTANT**: There are conflicting migration files:
- `20250623075356_optimize-upload-post-integration.sql` - Moves upload-post TO businesses table  
- This phase document - Moves upload-post FROM businesses table TO social_integrations

**DECISION**: Keep existing `upload_post_profiles` table approach since it's working. Update this phase to:
1. Enhance the existing `upload_post_profiles` table with new username generation
2. Keep the separate table structure (it's actually better separation of concerns)
3. Update username generation to use business names instead of "transformo"

### **Username Generation Issue**
Currently uses: `transformo_${business_id}` 
**New requirement**: Use business name instead of "transformo"
**New format**: `{sanitized_business_name}_{last_8_digits_of_business_id}`

### **Existing Components (ALL WORKING)**
- `components/shared/settings/social-media-integration-wrapper.tsx` ✅
- `app/actions/upload-post.ts` ✅
- `app/api/upload-post/` routes ✅
- `lib/upload-post.ts` (username generation) ✅

## **Migration Plan (UPDATED)**

### **Step 1: Update Username Generation**
Fix the username generation to use business names while keeping existing table structure.

### **Step 2: Update Upload-Post Validation**
Update validation functions to accept new username format.

### **Step 3: Update Existing Components**
Minimal updates to existing working components to use new username format.

### **Step 4: Database Function Updates**
Add database function for username generation to maintain consistency.

**NO TABLE CHANGES NEEDED - Keep existing upload_post_profiles table**

---

## **🤖 AI Implementation Checklist**

### **Phase 4.1: Database Schema Creation**

#### **Migration File Creation**
- [ ] Generate Brisbane timestamp: `TZ=Australia/Brisbane date +"%Y%m%d%H%M%S"`
- [ ] Create migration file: `supabase/migrations/{timestamp}_create-social-integrations-table.sql`
- [ ] Implement complete migration script (see Migration Script section below)
- [ ] Test migration locally: `supabase db push`
- [ ] Verify table creation: Query `information_schema.tables` to confirm table exists

#### **Migration Script**
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

### **Phase 4.2: Username Validation Updates**

#### **Update Upload-Post Validation**
- [ ] Open `lib/upload-post-validation.ts`
- [ ] Update username validation to accept new format
- [ ] Remove "transformo_" prefix requirement
- [ ] Test validation accepts business name format

**Updated Validation:**
```typescript
// Update this in lib/upload-post-validation.ts
const usernameSchema = z
  .string()
  .min(5, 'Username must be at least 5 characters')
  .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores')
  .refine(
    (value) => value.includes('_') && value.split('_').length >= 2,
    'Username must contain business identifier format (businessname_id)'
  );

// Remove the old transformo-specific validation
export function validateUploadPostUsername(username: string): string {
  const result = usernameSchema.safeParse(username);
  if (!result.success) {
    throw new Error(`Invalid username: ${result.error.errors[0]?.message}`);
  }
  return result.data;
}
```

#### **Update Upload-Post Library**
- [ ] Open `lib/upload-post.ts`  
- [ ] Update `validateUsername` function to remove "transformo_" requirement
- [ ] Verify `generateUploadPostUsername` function works correctly (it already does)
- [ ] Test username generation and validation

**Updated Validation Function:**
```typescript
// Update this function in lib/upload-post.ts
export function validateUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    throw new UploadPostValidationError('Username is required and must be a string');
  }
  
  // Sanitize username - only allow alphanumeric characters, underscores, and hyphens
  const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '');
  
  if (sanitized.length < 3 || sanitized.length > 50) {
    throw new UploadPostValidationError('Username must be between 3 and 50 characters');
  }
  
  // Ensure it contains underscore (business_name_id format)
  if (!sanitized.includes('_')) {
    throw new UploadPostValidationError('Invalid username format for business integration');
  }
  
  return sanitized;
}
```

### **Phase 4.3: Component Updates**

#### **Update Upload-Post Actions**
- [ ] Open `app/actions/upload-post.ts`
- [ ] Verify `generateUploadPostUsername` is imported correctly
- [ ] Test profile creation uses new username format
- [ ] Verify existing functionality continues to work

**Current Implementation Review:**
```typescript
// In app/actions/upload-post.ts - this should already work correctly
// Just verify the import and usage:

import { generateUploadPostUsername } from '@/lib/upload-post';

// In createUploadPostProfile function:
const uploadPostUsername = generateUploadPostUsername(business.business_name, profile.business_id);
```

#### **Update API Routes**
- [ ] Open `app/api/upload-post/profiles/route.ts`
- [ ] Verify username generation uses business name
- [ ] Test API endpoints work with new username format
- [ ] Verify existing error handling still works

**Current Implementation Review:**
```typescript
// In app/api/upload-post/profiles/route.ts - this should already work
// Just verify the usage:

const uploadPostUsername = generateUploadPostUsername(business.business_name, validatedBusinessId);
```

### **Phase 4.4: Testing & Validation**

#### **Database Testing**
- [ ] Run migration: `supabase db push`
- [ ] Test username generation function: 
  ```sql
  SELECT generate_upload_post_username('John''s Marketing Agency', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  -- Should return: johns_marketing_agency_3d479
  ```
- [ ] Verify existing upload_post_profiles table unchanged
- [ ] Test existing data still accessible

#### **Username Generation Testing**
- [ ] Test various business names:
  - "John's Marketing" → `johns_marketing_{id_suffix}`
  - "ABC Corp" → `abc_corp_{id_suffix}`
  - "123 Digital!" → `123_digital_{id_suffix}`
  - "" (empty) → `business_{id_suffix}`
- [ ] Verify function handles edge cases correctly

#### **Integration Testing**
- [ ] Test upload-post profile creation with new usernames
- [ ] Test social media connection flow still works
- [ ] Test existing profiles continue to function
- [ ] Verify JWT generation and social platform connections work

#### **UI Testing**
- [ ] Test social media integration wrapper loads correctly
- [ ] Test profile creation shows new username format
- [ ] Test connection flow works end-to-end
- [ ] Verify no UI errors or broken functionality

### **Phase 4.5: Cleanup**

#### **Remove Old Upload-Post Profiles Table**
- [ ] Create cleanup migration file
- [ ] Remove `upload_post_profiles` table
- [ ] Update TypeScript types
- [ ] Test everything still works after cleanup

**Cleanup Migration:**
```sql
-- Create new migration file: {timestamp}_remove-upload-post-profiles-table.sql

-- Remove the old upload_post_profiles table
DROP TABLE IF EXISTS public.upload_post_profiles;

-- Remove any old functions that referenced the old table
DROP FUNCTION IF EXISTS public.get_upload_post_profile(uuid);
```

#### **Update TypeScript Types**
- [ ] Run: `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] Update any type references in components
- [ ] Test TypeScript compilation: `npm run build`

### **Phase 4.6: Final Validation**

#### **Complete Integration Test**
- [ ] Create new upload-post integration from UI
- [ ] Verify integration saved in `social_integrations` table with business name username
- [ ] Test username follows new format: `{business_name}_{id_suffix}`
- [ ] Test social account sync functionality
- [ ] Test JWT URL generation and social media connection flow
- [ ] Test integration removal works
- [ ] Verify no errors in browser console
- [ ] Test with different business name formats

#### **Username Format Validation**
- [ ] Verify usernames no longer contain "transformo"
- [ ] Confirm business names are properly sanitized
- [ ] Test that spaces become underscores
- [ ] Verify special characters are removed
- [ ] Confirm business ID suffix provides uniqueness

#### **Performance Validation**
- [ ] Check integrations page load time improved
- [ ] Verify database queries are more efficient
- [ ] Test with multiple social providers (future-proofing)
- [ ] Confirm no N+1 query problems

---

## **Success Criteria**

### **Phase 4 Complete When:**
- [ ] ✅ `social_integrations` table created and populated
- [ ] ✅ Username generation uses business names instead of "transformo"
- [ ] ✅ All API routes updated and tested
- [ ] ✅ Social media integration components work with new structure
- [ ] ✅ Upload-post platform integration works with new usernames
- [ ] ✅ Old `upload_post_profiles` table removed
- [ ] ✅ TypeScript types updated
- [ ] ✅ All existing social media functionality preserved
- [ ] ✅ Performance improved (faster queries)

### **Ready for Phase 5 When:**
- [ ] ✅ All Phase 4 checklist items completed
- [ ] ✅ No errors in application logs
- [ ] ✅ Social integration fully functional with new username format
- [ ] ✅ Business names properly reflected in upload-post usernames
- [ ] ✅ Documentation updated
- [ ] ✅ Code review completed (if applicable)

---

## **Username Format Examples**

### **Before Migration:**
- `transformo_123e4567-e89b-12d3-a456-426614174000`
- `transformo_987f6543-e21c-34b5-d678-987654321000`

### **After Migration:**
- Business: "John's Marketing Agency" → `johns_marketing_agency_74000000`
- Business: "ABC Digital Solutions" → `abc_digital_solutions_21000000`
- Business: "Smith & Associates" → `smith_associates_87000000`
- Business: "123 Tech Startup" → `123_tech_startup_45000000`

---

**⚠️ Important Notes:**
- Ensure Phases 1-3 are completed before starting Phase 4
- Test username generation thoroughly with various business name formats
- Verify upload-post.com accepts the new username format
- Keep backup of working state before starting
- Document any issues encountered for future phases
- Test end-to-end social media connection flow with new usernames
</rewritten_file> 