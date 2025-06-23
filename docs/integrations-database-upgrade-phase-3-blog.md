# Phase 3: Blog Integration Migration

## **Overview**

This phase migrates blog integration from the `businesses` table to a specialized `blog_integrations` table. This provides better organization, performance, and flexibility for supporting multiple blog platforms.

## **Current State Analysis**

### **Current Implementation**
```sql
-- Current fields in businesses table
blog_provider TEXT,           -- 'wordpress' | 'wix'
blog_secret_id UUID,          -- Reference to vault.secrets
blog_username TEXT,           -- Blog username/login
blog_site_url TEXT            -- Blog site URL
```

### **Existing Components (ALL WORKING)**
- `components/shared/settings/blog-integration-form.tsx` ✅
- `app/actions/settings.ts` (blog functions) ✅
- `app/api/blog-integration/validate/route.ts` ✅

## **Migration Plan**

### **Step 1: Database Schema Creation**
Create new `blog_integrations` table with provider flexibility.

### **Step 2: API Layer Updates**
Update all blog-related actions and API routes.

### **Step 3: Component Updates**
Update React components to work with new structure.

### **Step 4: Cleanup**
Remove old blog fields from businesses table.

---

## **🤖 AI Implementation Checklist**

### **Phase 3.1: Database Schema Creation**

#### **Migration File Creation**
- [ ] Generate Brisbane timestamp: `TZ=Australia/Brisbane date +"%Y%m%d%H%M%S"`
- [ ] Create migration file: `supabase/migrations/{timestamp}_create-blog-integrations-table.sql`
- [ ] Implement complete migration script (see Migration Script section below)
- [ ] Test migration locally: `supabase db push`
- [ ] Verify table creation: Query `information_schema.tables` to confirm table exists

#### **Migration Script**
```sql
-- =================================================================
--          Blog Integrations Table Migration
-- =================================================================
-- This migration creates the specialized blog_integrations table
-- for blog platform integrations (WordPress, Wix).
-- =================================================================

-- Step 1: Create blog_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.blog_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider information
    provider TEXT NOT NULL CHECK (provider IN ('wordpress', 'wix')),
    
    -- Authentication credentials (stored in vault)
    secret_id UUID REFERENCES vault.secrets(id) ON DELETE SET NULL,
    
    -- Provider-specific configuration
    username TEXT, -- WordPress application username
    site_url TEXT NOT NULL, -- Blog site URL
    
    -- Provider-specific settings
    provider_config JSONB DEFAULT '{}',
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
    validated_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_blog_provider UNIQUE(business_id, provider, status) DEFERRABLE INITIALLY DEFERRED
);

-- Add table comments
COMMENT ON TABLE public.blog_integrations IS 'Blog platform integrations (WordPress, Wix)';
COMMENT ON COLUMN public.blog_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.blog_integrations.provider IS 'Blog platform provider (wordpress, wix)';
COMMENT ON COLUMN public.blog_integrations.secret_id IS 'Reference to vault secret containing API credentials';
COMMENT ON COLUMN public.blog_integrations.username IS 'Username for the blog platform (WordPress application username)';
COMMENT ON COLUMN public.blog_integrations.site_url IS 'URL of the blog/website';
COMMENT ON COLUMN public.blog_integrations.provider_config IS 'Additional provider-specific configuration';
COMMENT ON COLUMN public.blog_integrations.status IS 'Integration status (active, inactive, error, pending)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_blog_integrations_business_id ON public.blog_integrations(business_id);
CREATE INDEX idx_blog_integrations_provider ON public.blog_integrations(provider);
CREATE INDEX idx_blog_integrations_status ON public.blog_integrations(status);
CREATE INDEX idx_blog_integrations_site_url ON public.blog_integrations(site_url);

-- Step 3: Create RPC functions for blog integrations
-- -----------------------------------------------------------------

-- Function to get blog integration by business ID
CREATE OR REPLACE FUNCTION public.get_blog_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    username TEXT,
    site_url TEXT,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bi.id,
        bi.provider,
        bi.username,
        bi.site_url,
        bi.status,
        bi.validated_at
    FROM public.blog_integrations bi
    WHERE bi.business_id = p_business_id
      AND bi.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get blog secret from vault
CREATE OR REPLACE FUNCTION public.get_blog_secret_v2(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    -- Get secret ID from blog integration
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id
      AND status = 'active'
    LIMIT 1;
    
    IF v_secret_id IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Get secret value from vault
    SELECT decrypted_secret INTO v_secret_value
    FROM vault.decrypted_secrets
    WHERE id = v_secret_id;
    
    RETURN v_secret_value;
END;
$$;

-- Function to create/update blog integration
CREATE OR REPLACE FUNCTION public.set_blog_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_credential TEXT,
    p_username TEXT DEFAULT NULL,
    p_site_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_integration_id UUID;
    v_secret_id UUID;
    v_secret_name TEXT;
BEGIN
    -- Validate provider
    IF p_provider NOT IN ('wordpress', 'wix') THEN
        RAISE EXCEPTION 'Invalid blog provider: %', p_provider;
    END IF;
    
    -- Get existing secret ID if integration exists
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id
      AND provider = p_provider
      AND status = 'active';
    
    -- Create or update secret in vault
    IF v_secret_id IS NULL THEN
        v_secret_name := 'blog_' || p_provider || '_key_for_business_' || p_business_id::text;
        v_secret_id := vault.create_secret(p_credential, v_secret_name, 'Blog platform credential');
    ELSE
        PERFORM vault.update_secret(v_secret_id, p_credential);
    END IF;
    
    -- Insert or update integration
    INSERT INTO public.blog_integrations (
        business_id,
        provider,
        secret_id,
        username,
        site_url,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_username,
        p_site_url,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider, status) 
    DO UPDATE SET
        secret_id = v_secret_id,
        username = COALESCE(p_username, blog_integrations.username),
        site_url = COALESCE(p_site_url, blog_integrations.site_url),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Function to delete blog integration
CREATE OR REPLACE FUNCTION public.delete_blog_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.blog_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.blog_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_blog_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_blog_secret_v2(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_blog_integration(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_blog_integration(UUID) TO authenticated, service_role;

-- Step 4: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_blog_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER blog_integrations_updated_at
    BEFORE UPDATE ON public.blog_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_blog_integrations_updated_at();

-- No data migration needed in development environment
-- Existing blog integrations will be created fresh using new table structure
```

### **Phase 3.2: API Layer Updates**

#### **Update Blog Settings Actions**
- [ ] Open `app/actions/settings.ts`
- [ ] Update `updateBlogSettings` function to use new table
- [ ] Update `removeBlogCredentials` function to use new table
- [ ] Test action functions work correctly

**Updated Functions:**
```typescript
// Update these functions in app/actions/settings.ts

export async function updateBlogSettings(
  businessId: string,
  formData: z.infer<typeof blogSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = blogSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { blog_provider, blog_username, blog_credential, blog_site_url } = parsedData.data;

  try {
    // If credential is provided, create/update the integration
    if (blog_credential && blog_provider) {
      const { data: integrationId, error: rpcError } = await supabase.rpc('set_blog_integration', {
        p_business_id: businessId,
        p_provider: blog_provider,
        p_credential: blog_credential,
        p_username: blog_username,
        p_site_url: blog_site_url,
      });

      if (rpcError) {
        console.error('Error saving blog integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    }

    // Update additional fields if no credential provided but integration exists
    if (!blog_credential && (blog_username || blog_site_url)) {
      const { error: updateError } = await supabase
        .from('blog_integrations')
        .update({
          username: blog_username,
          site_url: blog_site_url,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating blog integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateBlogSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function removeBlogCredentials(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_blog_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting blog integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}
```

#### **Update Blog API Routes**
- [ ] Update `app/api/blog-integration/validate/route.ts`
- [ ] Test API routes return correct data

**Updated Validation Route:**
```typescript
// Update app/api/blog-integration/validate/route.ts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the user's business
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.business_id) {
      return NextResponse.json(
        { success: false, error: 'Business not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { provider, credential, siteUrl, username } = body;

    // Validate the blog credentials
    const result = await validateBlogCredentials(provider, credential, siteUrl, username);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Blog integration validation API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      },
      { status: 500 }
    );
  }
}
```

### **Phase 3.3: Component Updates**

#### **Update Blog Integration Form**
- [ ] Open `components/shared/settings/blog-integration-form.tsx`
- [ ] Update component to use new table structure
- [ ] Test form submission and validation
- [ ] Test remove functionality

**Updated Component Logic:**
```typescript
// Key changes to make in blog-integration-form.tsx

// Update the initial state detection
const [isKeySet, setIsKeySet] = useState(false);

// Add useEffect to check for existing integration
useEffect(() => {
  const checkExistingIntegration = async () => {
    if (business.id) {
      try {
        const supabase = createClient();
        const { data: integration } = await supabase
          .from('blog_integrations')
          .select('id, provider, username, site_url')
          .eq('business_id', business.id)
          .eq('status', 'active')
          .single();
        
        if (integration) {
          setIsKeySet(true);
          // Update form with existing data
          form.reset({
            blog_provider: integration.provider as 'wordpress' | 'wix',
            blog_username: integration.username || '',
            blog_site_url: integration.site_url || '',
          });
        }
      } catch (error) {
        console.error('Error checking existing integration:', error);
      }
    }
  };
  
  checkExistingIntegration();
}, [business.id, form]);
```

#### **Update Integrations Page**
- [ ] Open `app/(app)/settings/integrations/page.tsx`
- [ ] Update business data fetching to include blog integration status
- [ ] Test page loads correctly with new structure

**Updated Page Query:**
```typescript
// Update the business query in integrations page
const { data: business, error } = await supabase
  .from('businesses')
  .select(`
    *,
    blog_integrations!inner(
      id,
      provider,
      username,
      site_url,
      status,
      validated_at
    )
  `)
  .eq('id', profile.business_id)
  .single();

// Transform the data for backward compatibility
const transformedBusiness = {
  ...business,
  // Map blog integration fields for component compatibility
  blog_provider: business.blog_integrations?.[0]?.provider || null,
  blog_username: business.blog_integrations?.[0]?.username || null,
  blog_site_url: business.blog_integrations?.[0]?.site_url || null,
  blog_secret_id: business.blog_integrations?.[0]?.id ? 'exists' : null, // Indicate if integration exists
};
```

### **Phase 3.4: Testing & Validation**

#### **Database Testing**
- [ ] Run migration: `supabase db push`
- [ ] Verify table created: `SELECT * FROM blog_integrations LIMIT 1;`
- [ ] Test RPC functions work: `SELECT get_blog_integration('test-uuid');`

#### **API Testing**
- [ ] Test blog validation endpoint: `POST /api/blog-integration/validate`
- [ ] Test settings actions work with new table
- [ ] Verify all endpoints return expected data structure

#### **UI Testing**
- [ ] Test integrations page loads without errors
- [ ] Test blog form shows existing integration status
- [ ] Test new blog integration setup flow
- [ ] Test blog integration removal
- [ ] Test validation feedback for WordPress and Wix

### **Phase 3.5: Cleanup**

#### **Remove Old Fields from Businesses Table**
- [ ] Create cleanup migration file
- [ ] Remove blog-related columns from businesses table
- [ ] Update TypeScript types
- [ ] Test everything still works after cleanup

**Cleanup Migration:**
```sql
-- Create new migration file: {timestamp}_remove-blog-fields-from-businesses.sql

-- Remove blog-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS blog_provider,
DROP COLUMN IF EXISTS blog_secret_id,
DROP COLUMN IF EXISTS blog_username,
DROP COLUMN IF EXISTS blog_site_url;

-- Remove old RPC functions
DROP FUNCTION IF EXISTS public.set_blog_key(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.delete_blog_key(uuid);
DROP FUNCTION IF EXISTS public.get_blog_secret(uuid);
```

#### **Update TypeScript Types**
- [ ] Run: `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] Update any type references in components
- [ ] Test TypeScript compilation: `npm run build`

### **Phase 3.6: Final Validation**

#### **Complete Integration Test**
- [ ] Create new blog integration from UI
- [ ] Verify integration saved in `blog_integrations` table
- [ ] Test blog validation works for WordPress and Wix
- [ ] Test integration removal works
- [ ] Verify no errors in browser console

#### **Performance Validation**
- [ ] Check integrations page load time improved
- [ ] Verify database queries are more efficient
- [ ] Test with multiple blog providers per business
- [ ] Confirm no N+1 query problems

---

## **Success Criteria**

### **Phase 3 Complete When:**
- [ ] ✅ `blog_integrations` table created and populated
- [ ] ✅ All API routes updated and tested
- [ ] ✅ Blog integration form works with new structure
- [ ] ✅ Old blog fields removed from businesses table
- [ ] ✅ TypeScript types updated
- [ ] ✅ All existing blog functionality preserved
- [ ] ✅ Performance improved (faster queries)

### **Ready for Phase 4 When:**
- [ ] ✅ All Phase 3 checklist items completed
- [ ] ✅ No errors in application logs
- [ ] ✅ Blog integration fully functional
- [ ] ✅ Documentation updated
- [ ] ✅ Code review completed (if applicable)

---

**⚠️ Important Notes:**
- Ensure Phases 1 and 2 are completed before starting Phase 3
- Test thoroughly before proceeding to Phase 4
- Keep backup of working state before starting
- Document any issues encountered for future phases 