# Phase 1: Email Integration Migration

## **Overview**

This phase migrates email integration from the `businesses` table to a dedicated `email_integrations` table. This follows the proven architecture patterns used by major integration platforms.

## **Current State Analysis**

### **Current Implementation**
```sql
-- businesses table fields
email_provider TEXT CHECK (email_provider IN ('mailerlite', 'mailchimp', 'brevo'))
email_secret_id UUID REFERENCES vault.secrets(id)
email_sender_name TEXT
email_sender_email TEXT
email_selected_group_id TEXT
email_selected_group_name TEXT
email_validated_at TIMESTAMP WITH TIME ZONE
```

### **Existing Components**
- `components/shared/settings/email-integration-form.tsx`
- `app/actions/settings.ts` (email functions)
- `app/api/email-integration/` routes


## **Migration Plan**

### **Step 1: Database Schema Creation**
Create new `email_integrations` table with improved structure.



### **Step 2: API Layer Updates**
Update all API routes to use new table.

### **Step 3: Component Updates**
Update React components to work with new structure.

### **Step 4: Cleanup**
Remove old fields from `businesses` table.

---

## **🤖 AI Implementation Checklist**

### **Phase 1.1: Database Schema Creation**

#### **Migration File Creation**
- [ ] Generate Brisbane timestamp: `TZ=Australia/Brisbane date +"%Y%m%d%H%M%S"`
- [ ] Create migration file: `supabase/migrations/{timestamp}_create-email-integrations-table.sql`
- [ ] Implement complete migration script (see Migration Script section below)
- [ ] Test migration locally: `supabase db push`
- [ ] Verify table creation: Query `information_schema.tables` to confirm table exists

#### **Migration Script**
```sql
-- =================================================================
--          Email Integrations Table Migration
-- =================================================================
-- This migration creates the specialized email_integrations table
-- for email provider integrations.
-- =================================================================

-- Step 1: Create email_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.email_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider and configuration
    provider TEXT NOT NULL CHECK (provider IN ('mailerlite', 'mailchimp', 'brevo')),
    secret_id UUID REFERENCES vault.secrets(id),
    
    -- Sender configuration
    sender_name TEXT,
    sender_email TEXT,
    
    -- Group selection
    selected_group_id TEXT,
    selected_group_name TEXT,
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    validated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_email_provider UNIQUE(business_id, provider)
);

-- Add table comments
COMMENT ON TABLE public.email_integrations IS 'Email service provider integrations (MailerLite, MailChimp, Brevo)';
COMMENT ON COLUMN public.email_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.email_integrations.provider IS 'Email service provider (mailerlite, mailchimp, brevo)';
COMMENT ON COLUMN public.email_integrations.secret_id IS 'Reference to encrypted API key in vault.secrets';
COMMENT ON COLUMN public.email_integrations.status IS 'Integration status (active, inactive, error)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_email_integrations_business_id ON public.email_integrations(business_id);
CREATE INDEX idx_email_integrations_provider ON public.email_integrations(provider);
CREATE INDEX idx_email_integrations_status ON public.email_integrations(status);

-- Step 3: Email integrations table is ready for new data
-- No data migration needed in development environment

-- Step 4: Create RPC functions for email integrations
-- -----------------------------------------------------------------

-- Function to get email integration by business ID
CREATE OR REPLACE FUNCTION public.get_email_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    sender_name TEXT,
    sender_email TEXT,
    selected_group_id TEXT,
    selected_group_name TEXT,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ei.id,
        ei.provider,
        ei.sender_name,
        ei.sender_email,
        ei.selected_group_id,
        ei.selected_group_name,
        ei.status,
        ei.validated_at
    FROM public.email_integrations ei
    WHERE ei.business_id = p_business_id
      AND ei.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get decrypted email secret (updated for new table)
CREATE OR REPLACE FUNCTION public.get_email_secret_v2(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id 
    FROM public.email_integrations 
    WHERE business_id = p_business_id 
      AND status = 'active' 
    LIMIT 1;
    
    IF v_secret_id IS NOT NULL THEN
        SELECT decrypted_secret INTO v_secret_value 
        FROM vault.decrypted_secrets 
        WHERE id = v_secret_id;
        RETURN v_secret_value;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Function to set/update email integration
CREATE OR REPLACE FUNCTION public.set_email_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_api_key TEXT,
    p_sender_name TEXT DEFAULT NULL,
    p_sender_email TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_name TEXT;
    v_integration_id UUID;
BEGIN
    -- Validate provider
    IF p_provider NOT IN ('mailerlite', 'mailchimp', 'brevo') THEN
        RAISE EXCEPTION 'Invalid email provider: %', p_provider;
    END IF;
    
    -- Check if integration already exists
    SELECT id, secret_id INTO v_integration_id, v_secret_id
    FROM public.email_integrations
    WHERE business_id = p_business_id AND provider = p_provider;
    
    -- Create or update secret in vault
    IF v_secret_id IS NULL THEN
        v_secret_name := 'email_' || p_provider || '_key_for_business_' || p_business_id::text;
        v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'Email provider API key');
    ELSE
        PERFORM vault.update_secret(v_secret_id, p_api_key);
    END IF;
    
    -- Insert or update integration
    INSERT INTO public.email_integrations (
        business_id,
        provider,
        secret_id,
        sender_name,
        sender_email,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_sender_name,
        p_sender_email,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider) 
    DO UPDATE SET
        secret_id = v_secret_id,
        sender_name = COALESCE(p_sender_name, email_integrations.sender_name),
        sender_email = COALESCE(p_sender_email, email_integrations.sender_email),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Function to delete email integration
CREATE OR REPLACE FUNCTION public.delete_email_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.email_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.email_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_email_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_email_secret_v2(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_email_integration(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_email_integration(UUID) TO authenticated, service_role;

-- Step 5: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_email_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_integrations_updated_at
    BEFORE UPDATE ON public.email_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_email_integrations_updated_at();
```

### **Phase 1.2: API Layer Updates**

#### **Update Email Settings Actions**
- [ ] Open `app/actions/settings.ts`
- [ ] Update `updateEmailSettings` function to use new table
- [ ] Update `removeEmailApiKey` function to use new table
- [ ] Test action functions work correctly

**Updated Functions:**
```typescript
// Update this function in app/actions/settings.ts
export async function updateEmailSettings(
  businessId: string,
  formData: z.infer<typeof emailSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = emailSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { email_api_key, email_provider, email_sender_name, email_sender_email, email_selected_group_id, email_selected_group_name } = parsedData.data;

  try {
    // If API key is provided, create/update the integration
    if (email_api_key && email_provider) {
      const { data: integrationId, error: rpcError } = await supabase.rpc('set_email_integration', {
        p_business_id: businessId,
        p_provider: email_provider,
        p_api_key: email_api_key,
        p_sender_name: email_sender_name,
        p_sender_email: email_sender_email,
      });

      if (rpcError) {
        console.error('Error saving email integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    }

    // Update additional fields if no API key provided but integration exists
    if (!email_api_key && (email_sender_name || email_sender_email || email_selected_group_id)) {
      const { error: updateError } = await supabase
        .from('email_integrations')
        .update({
          sender_name: email_sender_name,
          sender_email: email_sender_email,
          selected_group_id: email_selected_group_id,
          selected_group_name: email_selected_group_name,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating email integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateEmailSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function removeEmailApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_email_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting email integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}
```

#### **Update Email API Routes**
- [ ] Update `app/api/email-integration/groups/route.ts`

- [ ] Test API routes return correct data

**Updated Groups Route:**
```typescript
// Update app/api/email-integration/groups/route.ts
export async function GET() {
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

    // Get email integration using new table
    const { data: emailIntegration, error: integrationError } = await supabase
      .from('email_integrations')
      .select('provider, secret_id')
      .eq('business_id', profile.business_id)
      .eq('status', 'active')
      .single();

    if (integrationError || !emailIntegration) {
      return NextResponse.json(
        { success: false, error: 'Email integration not found. Please set up your email integration first.' },
        { status: 400 }
      );
    }

    if (!emailIntegration.provider || !emailIntegration.secret_id) {
      return NextResponse.json(
        { success: false, error: 'Email provider not configured. Please set up your email integration first.' },
        { status: 400 }
      );
    }

    // Get the API key from vault using updated RPC function
    const { data: apiKey, error: secretError } = await supabase.rpc('get_email_secret_v2', {
      p_business_id: profile.business_id
    });

    if (secretError || !apiKey) {
      console.error('Error retrieving email API key:', secretError);
      return NextResponse.json(
        { success: false, error: 'Unable to retrieve API key. Please reconfigure your email integration.' },
        { status: 500 }
      );
    }

    // Validate API key and fetch groups from the provider
    const result = await validateEmailProviderAndFetchGroups(
      emailIntegration.provider as 'mailerlite' | 'mailchimp' | 'brevo',
      apiKey
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    // Check if no groups were found
    if (!result.groups || result.groups.length === 0) {
      return NextResponse.json({
        success: true,
        groups: [],
        message: `No email groups found in your ${emailIntegration.provider} account. Please create a group first.`
      });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Email integration groups API error:', error);
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



### **Phase 1.3: Component Updates**

#### **Update Email Integration Form**
- [ ] Open `components/shared/settings/email-integration-form.tsx`
- [ ] Update component to use new table structure
- [ ] Test form submission and validation
- [ ] Test remove functionality
- [ ] Test group loading

**Updated Component Logic:**
```typescript
// Key changes to make in email-integration-form.tsx

// Update the initial state detection
const [isKeySet, setIsKeySet] = useState(false);

// Add useEffect to check for existing integration
useEffect(() => {
  const checkExistingIntegration = async () => {
    if (business.id) {
      try {
        const supabase = createClient();
        const { data: integration } = await supabase
          .from('email_integrations')
          .select('id, provider, sender_name, sender_email, selected_group_id, selected_group_name')
          .eq('business_id', business.id)
          .eq('status', 'active')
          .single();
        
        if (integration) {
          setIsKeySet(true);
          // Update form with existing data
          form.reset({
            email_provider: integration.provider as 'mailerlite' | 'mailchimp' | 'brevo',
            email_sender_name: integration.sender_name || '',
            email_sender_email: integration.sender_email || '',
            email_selected_group_id: integration.selected_group_id || '',
            email_selected_group_name: integration.selected_group_name || '',
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
- [ ] Update business data fetching to include email integration status
- [ ] Test page loads correctly with new structure

**Updated Page Query:**
```typescript
// Update the business query in integrations page
const { data: business, error } = await supabase
  .from('businesses')
  .select(`
    *,
    email_integrations!inner(
      id,
      provider,
      sender_name,
      sender_email,
      selected_group_id,
      selected_group_name,
      status,
      validated_at
    )
  `)
  .eq('id', profile.business_id)
  .single();

// Transform the data for backward compatibility
const transformedBusiness = {
  ...business,
  // Map email integration fields for component compatibility
  email_provider: business.email_integrations?.[0]?.provider || null,
  email_sender_name: business.email_integrations?.[0]?.sender_name || null,
  email_sender_email: business.email_integrations?.[0]?.sender_email || null,
  email_selected_group_id: business.email_integrations?.[0]?.selected_group_id || null,
  email_selected_group_name: business.email_integrations?.[0]?.selected_group_name || null,
  email_validated_at: business.email_integrations?.[0]?.validated_at || null,
  email_secret_id: business.email_integrations?.[0]?.id ? 'exists' : null, // Indicate if integration exists
};
```

### **Phase 1.4: Testing & Validation**

#### **Database Testing**
- [ ] Run migration: `supabase db push`
- [ ] Verify table created: `SELECT * FROM email_integrations LIMIT 1;`
- [ ] Test RPC functions work: `SELECT get_email_integration('test-uuid');`


#### **API Testing**
- [ ] Test email groups endpoint: `GET /api/email-integration/groups`

- [ ] Test validation endpoint: `POST /api/email-integration/validate`
- [ ] Verify all endpoints return expected data structure

#### **UI Testing**
- [ ] Test integrations page loads without errors
- [ ] Test email form shows existing integration status
- [ ] Test new email integration setup flow
- [ ] Test email integration removal
- [ ] Test group selection functionality
- [ ] Test validation feedback



### **Phase 1.5: Cleanup**

#### **Remove Old Fields from Businesses Table**
- [ ] Create cleanup migration file
- [ ] Remove email-related columns from businesses table
- [ ] Update TypeScript types
- [ ] Test everything still works after cleanup

**Cleanup Migration:**
```sql
-- Create new migration file: {timestamp}_remove-email-fields-from-businesses.sql

-- Remove email-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS email_provider,
DROP COLUMN IF EXISTS email_secret_id,
DROP COLUMN IF EXISTS email_sender_name,
DROP COLUMN IF EXISTS email_sender_email,
DROP COLUMN IF EXISTS email_selected_group_id,
DROP COLUMN IF EXISTS email_selected_group_name,
DROP COLUMN IF EXISTS email_validated_at;

-- Remove old RPC functions
DROP FUNCTION IF EXISTS public.set_email_key(uuid, text);
DROP FUNCTION IF EXISTS public.delete_email_key(uuid);
DROP FUNCTION IF EXISTS public.get_email_secret(uuid);
```

#### **Update TypeScript Types**
- [ ] Run: `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] Update any type references in components
- [ ] Test TypeScript compilation: `npm run build`

### **Phase 1.6: Final Validation**

#### **Complete Integration Test**
- [ ] Create new email integration from UI
- [ ] Verify integration saved in `email_integrations` table

- [ ] Test email group fetching works
- [ ] Test integration removal works
- [ ] Verify no errors in browser console
- [ ] Test with all supported providers (MailerLite, MailChimp, Brevo)

#### **Performance Validation**
- [ ] Check integrations page load time improved
- [ ] Verify database queries are more efficient
- [ ] Test with multiple integrations per business
- [ ] Confirm no N+1 query problems

---

## **Success Criteria**

### **Phase 1 Complete When:**
- [ ] ✅ `email_integrations` table created and populated
- [ ] ✅ All API routes updated and tested
- [ ] ✅ Email integration form works with new structure

- [ ] ✅ Old email fields removed from businesses table
- [ ] ✅ TypeScript types updated
- [ ] ✅ All existing email functionality preserved
- [ ] ✅ Performance improved (faster queries)

### **Ready for Phase 2 When:**
- [ ] ✅ All Phase 1 checklist items completed
- [ ] ✅ No errors in application logs
- [ ] ✅ Email integration fully functional
- [ ] ✅ Documentation updated
- [ ] ✅ Code review completed (if applicable)

---

**⚠️ Important Notes:**
- Test thoroughly before proceeding to Phase 2
- Keep backup of working state before starting
- Document any issues encountered for future phases
 