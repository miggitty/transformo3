# Phase 2: AI Avatar Integration Migration

## **Overview**

This phase migrates AI avatar integration (HeyGen) from the `businesses` table to a dedicated `ai_avatar_integrations` table. This builds on the patterns established in Phase 1.

## **Current State Analysis**

### **Current Implementation**
```sql
-- businesses table fields
heygen_secret_id UUID REFERENCES vault.secrets(id)
heygen_avatar_id TEXT
heygen_voice_id TEXT
```

### **Existing Components**
- `components/shared/settings/heygen-settings-form.tsx`
- `app/actions/settings.ts` (heygen functions)
- HeyGen AI avatar video generation workflows

## **Migration Plan**

### **Step 1: Database Schema Creation**
Create new `ai_avatar_integrations` table with provider flexibility.



### **Step 2: API Layer Updates**
Update all HeyGen-related API routes and actions.

### **Step 3: Component Updates**
Update React components to work with new structure.

### **Step 4: Cleanup**
Remove old fields from `businesses` table.

---

## **🤖 AI Implementation Checklist**

### **Phase 2.1: Database Schema Creation**

#### **Migration File Creation**
- [ ] Generate Brisbane timestamp: `TZ=Australia/Brisbane date +"%Y%m%d%H%M%S"`
- [ ] Create migration file: `supabase/migrations/{timestamp}_create-ai-avatar-integrations-table.sql`
- [ ] Implement complete migration script (see Migration Script section below)
- [ ] Test migration locally: `supabase db push`
- [ ] Verify table creation: Query `information_schema.tables` to confirm table exists

#### **Migration Script**
```sql
-- =================================================================
--          AI Avatar Integrations Table Migration
-- =================================================================
-- This migration creates the specialized ai_avatar_integrations table
-- for AI avatar service integrations.
-- =================================================================

-- Step 1: Create ai_avatar_integrations table
-- -----------------------------------------------------------------
CREATE TABLE public.ai_avatar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Provider and configuration
    provider TEXT NOT NULL CHECK (provider IN ('heygen')),
    secret_id UUID REFERENCES vault.secrets(id),
    
    -- Provider-specific configuration
    avatar_id TEXT,
    voice_id TEXT,
    
    -- Additional provider settings (JSONB for flexibility)
    provider_config JSONB DEFAULT '{}',
    
    -- Status and validation
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    validated_at TIMESTAMP WITH TIME ZONE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active integration per business per provider
    CONSTRAINT unique_business_ai_avatar_provider UNIQUE(business_id, provider)
);

-- Add table comments
COMMENT ON TABLE public.ai_avatar_integrations IS 'AI avatar video generation service integrations (HeyGen, future providers)';
COMMENT ON COLUMN public.ai_avatar_integrations.business_id IS 'Reference to the business that owns this integration';
COMMENT ON COLUMN public.ai_avatar_integrations.provider IS 'AI avatar service provider (heygen)';
COMMENT ON COLUMN public.ai_avatar_integrations.secret_id IS 'Reference to encrypted API key in vault.secrets';
COMMENT ON COLUMN public.ai_avatar_integrations.avatar_id IS 'Provider-specific avatar identifier';
COMMENT ON COLUMN public.ai_avatar_integrations.voice_id IS 'Provider-specific voice identifier';
COMMENT ON COLUMN public.ai_avatar_integrations.provider_config IS 'Additional provider-specific configuration';
COMMENT ON COLUMN public.ai_avatar_integrations.status IS 'Integration status (active, inactive, error)';

-- Step 2: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_ai_avatar_integrations_business_id ON public.ai_avatar_integrations(business_id);
CREATE INDEX idx_ai_avatar_integrations_provider ON public.ai_avatar_integrations(provider);
CREATE INDEX idx_ai_avatar_integrations_status ON public.ai_avatar_integrations(status);

-- Step 3: AI avatar integrations table is ready for new data
-- No data migration needed in development environment

-- Step 4: Create RPC functions for AI avatar integrations
-- -----------------------------------------------------------------

-- Function to get AI avatar integration by business ID
CREATE OR REPLACE FUNCTION public.get_ai_avatar_integration(p_business_id UUID)
RETURNS TABLE (
    id UUID,
    provider TEXT,
    avatar_id TEXT,
    voice_id TEXT,
    provider_config JSONB,
    status TEXT,
    validated_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ai.id,
        ai.provider,
        ai.avatar_id,
        ai.voice_id,
        ai.provider_config,
        ai.status,
        ai.validated_at
    FROM public.ai_avatar_integrations ai
    WHERE ai.business_id = p_business_id
      AND ai.status = 'active'
    LIMIT 1;
END;
$$;

-- Function to get decrypted AI avatar secret (updated for new table)
CREATE OR REPLACE FUNCTION public.get_ai_avatar_secret(p_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_secret_value TEXT;
BEGIN
    SELECT secret_id INTO v_secret_id 
    FROM public.ai_avatar_integrations 
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

-- Function to set/update AI avatar integration
CREATE OR REPLACE FUNCTION public.set_ai_avatar_integration(
    p_business_id UUID,
    p_provider TEXT,
    p_api_key TEXT,
    p_avatar_id TEXT DEFAULT NULL,
    p_voice_id TEXT DEFAULT NULL,
    p_config JSONB DEFAULT '{}'
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
    IF p_provider NOT IN ('heygen') THEN
        RAISE EXCEPTION 'Invalid AI avatar provider: %', p_provider;
    END IF;
    
    -- Check if integration already exists
    SELECT id, secret_id INTO v_integration_id, v_secret_id
    FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id AND provider = p_provider;
    
    -- Create or update secret in vault
    IF v_secret_id IS NULL THEN
        v_secret_name := 'ai_avatar_' || p_provider || '_key_for_business_' || p_business_id::text;
        v_secret_id := vault.create_secret(p_api_key, v_secret_name, 'AI avatar provider API key');
    ELSE
        PERFORM vault.update_secret(v_secret_id, p_api_key);
    END IF;
    
    -- Insert or update integration
    INSERT INTO public.ai_avatar_integrations (
        business_id,
        provider,
        secret_id,
        avatar_id,
        voice_id,
        provider_config,
        status,
        validated_at
    ) VALUES (
        p_business_id,
        p_provider,
        v_secret_id,
        p_avatar_id,
        p_voice_id,
        p_config,
        'active',
        NOW()
    )
    ON CONFLICT (business_id, provider) 
    DO UPDATE SET
        secret_id = v_secret_id,
        avatar_id = COALESCE(p_avatar_id, ai_avatar_integrations.avatar_id),
        voice_id = COALESCE(p_voice_id, ai_avatar_integrations.voice_id),
        provider_config = COALESCE(p_config, ai_avatar_integrations.provider_config),
        status = 'active',
        validated_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_integration_id;
    
    RETURN v_integration_id;
END;
$$;

-- Function to delete AI avatar integration
CREATE OR REPLACE FUNCTION public.delete_ai_avatar_integration(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
BEGIN
    -- Get secret ID before deletion
    SELECT secret_id INTO v_secret_id
    FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id;
    
    -- Delete integration record
    DELETE FROM public.ai_avatar_integrations
    WHERE business_id = p_business_id;
    
    -- Delete secret from vault if it exists
    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_ai_avatar_integration(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_ai_avatar_secret(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_ai_avatar_integration(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_ai_avatar_integration(UUID) TO authenticated, service_role;

-- Step 5: Create updated_at trigger
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_ai_avatar_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_avatar_integrations_updated_at
    BEFORE UPDATE ON public.ai_avatar_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_avatar_integrations_updated_at();
```

### **Phase 2.2: API Layer Updates**

#### **Update HeyGen Settings Actions**
- [ ] Open `app/actions/settings.ts`
- [ ] Update `updateHeygenSettings` function to use new table
- [ ] Update `removeHeygenApiKey` function to use new table
- [ ] Update `generateHeygenVideo` function if needed
- [ ] Test action functions work correctly

**Updated Functions:**
```typescript
// Update these functions in app/actions/settings.ts

export async function updateHeygenSettings(
  businessId: string,
  formData: z.infer<typeof heygenSettingsFormSchema>
) {
  const supabase = await createClient();

  const parsedData = heygenSettingsFormSchema.safeParse(formData);
  if (!parsedData.success) {
    const errorMessages = parsedData.error.flatten().fieldErrors;
    const firstError = Object.values(errorMessages)[0]?.[0] || 'Invalid form data.';
    return { error: firstError };
  }

  const { heygen_api_key, heygen_avatar_id, heygen_voice_id } = parsedData.data;

  try {
    // If API key is provided, create/update the integration
    if (heygen_api_key) {
      const { data: integrationId, error: rpcError } = await supabase.rpc('set_ai_avatar_integration', {
        p_business_id: businessId,
        p_provider: 'heygen',
        p_api_key: heygen_api_key,
        p_avatar_id: heygen_avatar_id,
        p_voice_id: heygen_voice_id,
      });

      if (rpcError) {
        console.error('Error saving AI avatar integration:', rpcError);
        return { error: `Database error: ${rpcError.message}` };
      }
    } else {
      // Update only configuration fields if no API key provided
      const { error: updateError } = await supabase
        .from('ai_avatar_integrations')
        .update({
          avatar_id: heygen_avatar_id,
          voice_id: heygen_voice_id,
          updated_at: new Date().toISOString(),
        })
        .eq('business_id', businessId)
        .eq('provider', 'heygen')
        .eq('status', 'active');

      if (updateError) {
        console.error('Error updating AI avatar integration:', updateError);
        return { error: `Could not update settings: ${updateError.message}` };
      }
    }

    revalidatePath('/settings/integrations');
    return { success: true };
  } catch (error) {
    console.error('Error in updateHeygenSettings:', error);
    return { error: 'An unexpected error occurred' };
  }
}

export async function removeHeygenApiKey(businessId: string) {
  const supabase = await createClient();

  const { error } = await supabase.rpc('delete_ai_avatar_integration', {
    p_business_id: businessId,
  });

  if (error) {
    console.error('Error deleting AI avatar integration:', error);
    return { error: `Database error: ${error.message}` };
  }

  revalidatePath('/settings/integrations');
  return { success: true };
}

// Update generateHeygenVideo to use new secret function
export async function generateHeygenVideo(
  businessId: string,
  contentId: string,
  script: string
) {
  const supabase = await createClient();

  try {
    // Check if AI avatar integration exists
    const { data: aiAvatarIntegration } = await supabase
      .from('ai_avatar_integrations')
      .select('id, avatar_id, voice_id')
      .eq('business_id', businessId)
      .eq('provider', 'heygen')
      .eq('status', 'active')
      .single();

    if (!aiAvatarIntegration) {
      return { error: 'HeyGen AI avatar integration not configured. Please set up your HeyGen integration first.' };
    }

    // First, update the content status to 'processing'
    const { error: updateError } = await supabase
      .from('content')
      .update({
        heygen_status: 'processing'
      })
      .eq('id', contentId);

    if (updateError) {
      console.error('Error updating content status:', updateError);
      return { error: `Could not start video generation: ${updateError.message}` };
    }

    // Then, trigger the n8n webhook
    const webhookUrl = process.env.N8N_HEYGEN_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.error('N8N_HEYGEN_WEBHOOK_URL is not set.');
      return { error: 'Webhook URL is not configured.' };
    }
    
    const payload = {
      business_id: businessId,
      content_id: contentId,
      script: script
    };

    console.log('Calling n8n webhook:', webhookUrl, 'with payload:', payload);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`n8n webhook call failed with status ${response.status}:`, errorBody);
      
      // Revert the status update if webhook fails
      await supabase
        .from('content')
        .update({ heygen_status: null })
        .eq('id', contentId);
        
      return { error: `Failed to trigger video generation: ${response.statusText}` };
    }

    console.log('n8n webhook called successfully');
    revalidatePath(`/content/${contentId}`);
    return { success: true };

  } catch (error) {
    console.error('Error in generateHeygenVideo:', error);
    
    // Revert the status update if there's an error
    await supabase
      .from('content')
      .update({ heygen_status: null })
      .eq('id', contentId);
      
    return { error: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
```

#### **Update HeyGen API Routes**
- [ ] Update any existing HeyGen API routes to use new table structure
- [ ] Test API routes return correct data


### **Phase 2.3: Component Updates**

#### **Update HeyGen Settings Form**
- [ ] Open `components/shared/settings/heygen-settings-form.tsx`
- [ ] Update component to use new table structure
- [ ] Test form submission and validation
- [ ] Test remove functionality

**Updated Component Logic:**
```typescript
// Key changes to make in heygen-settings-form.tsx

// Update the initial state detection
const [isKeySet, setIsKeySet] = useState(false);

// Add useEffect to check for existing integration
useEffect(() => {
  const checkExistingIntegration = async () => {
    if (business.id) {
      try {
        const supabase = createClient();
        const { data: integration } = await supabase
          .from('ai_avatar_integrations')
          .select('id, provider, avatar_id, voice_id')
          .eq('business_id', business.id)
          .eq('provider', 'heygen')
          .eq('status', 'active')
          .single();
        
        if (integration) {
          setIsKeySet(true);
          // Update form with existing data
          form.reset({
            heygen_avatar_id: integration.avatar_id || '',
            heygen_voice_id: integration.voice_id || '',
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
- [ ] Update business data fetching to include AI avatar integration status
- [ ] Update card title and description to reflect AI Avatar branding
- [ ] Test page loads correctly with new structure

**Updated Page Query:**
```typescript
// Update the business query in integrations page
const { data: business, error } = await supabase
  .from('businesses')
  .select(`
    *,
    ai_avatar_integrations!inner(
      id,
      provider,
      avatar_id,
      voice_id,
      status,
      validated_at
    )
  `)
  .eq('id', profile.business_id)
  .single();

// Transform the data for backward compatibility
const transformedBusiness = {
  ...business,
  // Map AI avatar integration fields for component compatibility
  heygen_avatar_id: business.ai_avatar_integrations?.[0]?.avatar_id || null,
  heygen_voice_id: business.ai_avatar_integrations?.[0]?.voice_id || null,
  heygen_secret_id: business.ai_avatar_integrations?.[0]?.id ? 'exists' : null, // Indicate if integration exists
};
```

**Updated Integration Card:**
```tsx
// Update the card in integrations page
<Card>
  <CardHeader>
    <CardTitle>AI Avatar Video Generation</CardTitle>
    <CardDescription>
      Configure your HeyGen integration for AI avatar video generation with custom avatars and voices.
    </CardDescription>
  </CardHeader>
  <HeygenSettingsForm business={transformedBusiness} />
</Card>
```

### **Phase 2.4: Testing & Validation**

#### **Database Testing**
- [ ] Run migration: `supabase db push`
- [ ] Verify table created: `SELECT * FROM ai_avatar_integrations LIMIT 1;`
- [ ] Test RPC functions work: `SELECT get_ai_avatar_integration('test-uuid');`


#### **API Testing**
- [ ] Test HeyGen credentials endpoint: `POST /api/n8n/heygen-credentials`
- [ ] Test settings actions work with new table
- [ ] Verify all endpoints return expected data structure

#### **UI Testing**
- [ ] Test integrations page loads without errors
- [ ] Test HeyGen form shows existing integration status
- [ ] Test new HeyGen integration setup flow
- [ ] Test HeyGen integration removal
- [ ] Test AI avatar video generation functionality
- [ ] Verify card title shows "AI Avatar Video Generation"



### **Phase 2.5: Cleanup**

#### **Remove Old Fields from Businesses Table**
- [ ] Create cleanup migration file
- [ ] Remove HeyGen-related columns from businesses table
- [ ] Update TypeScript types
- [ ] Test everything still works after cleanup

**Cleanup Migration:**
```sql
-- Create new migration file: {timestamp}_remove-heygen-fields-from-businesses.sql

-- Remove HeyGen-related columns from businesses table
ALTER TABLE public.businesses 
DROP COLUMN IF EXISTS heygen_secret_id,
DROP COLUMN IF EXISTS heygen_avatar_id,
DROP COLUMN IF EXISTS heygen_voice_id;

-- Remove old RPC functions
DROP FUNCTION IF EXISTS public.set_heygen_key(uuid, text);
DROP FUNCTION IF EXISTS public.delete_heygen_key(uuid);
DROP FUNCTION IF EXISTS public.get_heygen_secret(uuid);
```

#### **Update TypeScript Types**
- [ ] Run: `npx supabase gen types typescript --local > types/supabase.ts`
- [ ] Update any type references in components
- [ ] Test TypeScript compilation: `npm run build`

### **Phase 2.6: Final Validation**

#### **Complete Integration Test**
- [ ] Create new HeyGen integration from UI
- [ ] Verify integration saved in `ai_avatar_integrations` table

- [ ] Test AI avatar video generation functionality
- [ ] Test integration removal works
- [ ] Verify no errors in browser console
- [ ] Confirm UI shows "AI Avatar Video Generation" branding

#### **Performance Validation**
- [ ] Check integrations page load time improved
- [ ] Verify database queries are more efficient
- [ ] Test with multiple AI avatar providers (future-proofing)
- [ ] Confirm no N+1 query problems

---

## **Success Criteria**

### **Phase 2 Complete When:**
- [ ] ✅ `ai_avatar_integrations` table created and populated
- [ ] ✅ All API routes updated and tested
- [ ] ✅ HeyGen integration form works with new structure

- [ ] ✅ Old HeyGen fields removed from businesses table
- [ ] ✅ TypeScript types updated
- [ ] ✅ All existing HeyGen functionality preserved
- [ ] ✅ UI shows "AI Avatar Video Generation" branding
- [ ] ✅ Performance improved (faster queries)

### **Ready for Phase 3 When:**
- [ ] ✅ All Phase 2 checklist items completed
- [ ] ✅ No errors in application logs
- [ ] ✅ AI avatar integration fully functional
- [ ] ✅ Documentation updated
- [ ] ✅ Code review completed (if applicable)

---

**⚠️ Important Notes:**
- Ensure Phase 1 is completed before starting Phase 2

- Keep backup of working state before starting
- Document any issues encountered for future phases
- The new naming better reflects the AI avatar nature of the integration 