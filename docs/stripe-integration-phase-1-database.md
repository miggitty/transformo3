# **Phase 1: Database Schema & Migrations**

**← [Back to Main PRD](./stripe-integration-prd.md)**

---

## **Phase Overview**
Set up the database foundation for Stripe integration following Transformo's established migration patterns and naming conventions.

**Duration**: 2-3 hours  
**Prerequisites**: Understanding of Supabase migrations and Brisbane timezone naming

---

## **📋 Phase 1 Checklist**

### **Migration File Creation**
- [ ] Generate migration timestamp using Brisbane timezone
- [ ] Create migration file with proper naming convention
- [ ] Add businesses table modifications
- [ ] Create subscriptions table with RLS
- [ ] Create stripe_events table for webhook tracking
- [ ] Add proper foreign key relationships
- [ ] Create necessary indexes for performance

### **Database Schema Updates**
- [ ] Add `stripe_customer_id` to businesses table
- [ ] Create subscriptions table with all required fields
- [ ] Create stripe_events table for idempotency
- [ ] Set up RLS policies for data protection
- [ ] Create indexes for subscription lookups
- [ ] Verify schema follows existing patterns

### **Validation**
- [ ] Migration runs successfully on local Supabase
- [ ] Generate new TypeScript types
- [ ] Verify RLS policies work correctly
- [ ] Test foreign key constraints
- [ ] Confirm indexes are created

---

## **1. Migration File Creation**

### **1.1 Generate Migration Timestamp**
Following app's Brisbane timezone convention:

```bash
# Option 1: Use Supabase CLI (respects your system timezone)
supabase migration new "add-stripe-subscription-schema"

# Option 2: Manual Brisbane timestamp
timestamp=$(TZ=Australia/Brisbane date +"%Y%m%d%H%M%S")
touch "supabase/migrations/${timestamp}_add-stripe-subscription-schema.sql"
```

### **1.2 Migration File Structure**
The migration file should follow this pattern: `YYYYMMDDHHMMSS_add-stripe-subscription-schema.sql`

---

## **2. Database Schema Implementation**

### **2.1 Businesses Table Modification**

```sql
-- Add Stripe customer ID to businesses table
-- Following the pattern of other integration IDs (heygen_secret_id, email_secret_id)
ALTER TABLE public.businesses
ADD COLUMN stripe_customer_id TEXT UNIQUE;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.stripe_customer_id IS 'Stripe Customer ID for billing and subscription management';
```

### **2.2 Subscriptions Table Creation**

```sql
-- Create subscriptions table following app's table patterns
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses (following business-centric model)
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Stripe-specific fields
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
    
    -- Subscription details
    price_id TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one subscription per business
    CONSTRAINT unique_business_subscription UNIQUE(business_id)
);

-- Add table comment
COMMENT ON TABLE public.subscriptions IS 'Stores Stripe subscription data synced via webhooks';

-- Add column comments
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID (cus_...) - denormalized for quick lookups';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN public.subscriptions.price_id IS 'Stripe price ID (price_...) for current plan';
```

### **2.3 Stripe Events Table Creation**

```sql
-- Create table for webhook event tracking (idempotency)
CREATE TABLE public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Stripe event details
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional: store event data for debugging
    event_data JSONB
);

-- Add table comment
COMMENT ON TABLE public.stripe_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN public.stripe_events.stripe_event_id IS 'Stripe event ID (evt_...) for idempotency checking';
```

### **2.4 Indexes for Performance**

```sql
-- Add indexes following app's performance patterns
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at);
```

---

## **3. Row Level Security (RLS) Setup**

### **3.1 Enable RLS on New Tables**

```sql
-- Enable RLS following app's security patterns
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
```

### **3.2 RLS Policies for Subscriptions**

```sql
-- Policy for authenticated users to access their business subscription
CREATE POLICY "Users can access their business subscription" ON public.subscriptions
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

-- Policy for service role (for webhook handlers)
CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
    FOR ALL TO service_role USING (true);
```

### **3.3 RLS Policies for Stripe Events**

```sql
-- Policy for service role only (webhook handlers)
CREATE POLICY "Service role can manage stripe events" ON public.stripe_events
    FOR ALL TO service_role USING (true);

-- No authenticated user access needed for stripe_events table
-- This table is purely for webhook processing
```

---

## **4. Updated Trigger Function**

### **4.1 Auto-update Trigger for Subscriptions**

```sql
-- Create trigger function for updated_at (following existing pattern from content table)
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_subscriptions_updated_at_trigger
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();
```

---

## **5. Complete Migration File**

### **5.1 Full Migration Script**

```sql
-- =================================================================
--          Stripe Subscription Integration Migration
-- =================================================================
-- This migration adds Stripe subscription support following
-- Transformo's established patterns and conventions.
-- =================================================================

-- Step 1: Add Stripe customer ID to businesses table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN stripe_customer_id TEXT UNIQUE;

COMMENT ON COLUMN public.businesses.stripe_customer_id IS 'Stripe Customer ID for billing and subscription management';

-- Step 2: Create subscriptions table
-- -----------------------------------------------------------------
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Stripe-specific fields
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),
    
    -- Subscription details
    price_id TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one subscription per business
    CONSTRAINT unique_business_subscription UNIQUE(business_id)
);

-- Add comments
COMMENT ON TABLE public.subscriptions IS 'Stores Stripe subscription data synced via webhooks';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID (cus_...) - denormalized for quick lookups';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN public.subscriptions.price_id IS 'Stripe price ID (price_...) for current plan';

-- Step 3: Create stripe_events table for webhook idempotency
-- -----------------------------------------------------------------
CREATE TABLE public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Stripe event details
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional: store event data for debugging
    event_data JSONB
);

-- Add comments
COMMENT ON TABLE public.stripe_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN public.stripe_events.stripe_event_id IS 'Stripe event ID (evt_...) for idempotency checking';

-- Step 4: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at);

-- Step 5: Enable Row Level Security
-- -----------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
-- -----------------------------------------------------------------
-- Subscriptions policies
CREATE POLICY "Users can access their business subscription" ON public.subscriptions
    FOR ALL USING (
        business_id IN (
            SELECT business_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
    FOR ALL TO service_role USING (true);

-- Stripe events policies (service role only)
CREATE POLICY "Service role can manage stripe events" ON public.stripe_events
    FOR ALL TO service_role USING (true);

-- Step 7: Create updated_at trigger function
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_subscriptions_updated_at_trigger
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();
```

---

## **6. Running the Migration**

### **6.1 Execute Migration**

```bash
# Push migration to local Supabase
supabase db push

# Verify migration was applied
supabase db diff
```

### **6.2 Generate Updated Types**

```bash
# Generate new TypeScript types
npx supabase gen types typescript --local > types/supabase.ts
```

### **6.3 Verify Schema**

```sql
-- Check that tables were created correctly
\d+ public.subscriptions
\d+ public.stripe_events

-- Verify RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('subscriptions', 'stripe_events');

-- Check indexes
\di public.idx_subscriptions_*
\di public.idx_stripe_events_*
```

---

## **7. Testing & Validation**

### **7.1 Test RLS Policies**

```sql
-- Test as authenticated user (should only see their business subscription)
SET ROLE authenticated;
SELECT * FROM subscriptions; -- Should return empty or only user's business data

-- Test as service role (should see all)
SET ROLE service_role;
SELECT * FROM subscriptions; -- Should have full access
```

### **7.2 Test Foreign Key Constraints**

```sql
-- Test that invalid business_id is rejected
INSERT INTO subscriptions (business_id, stripe_subscription_id, stripe_customer_id, status, price_id, current_period_start, current_period_end)
VALUES ('00000000-0000-0000-0000-000000000000', 'sub_test', 'cus_test', 'active', 'price_test', NOW(), NOW() + INTERVAL '1 month');
-- Should fail with foreign key constraint error
```

---

## **✅ Phase 1 Completion Criteria**

Before moving to Phase 2, verify:

- [ ] Migration file created with correct Brisbane timezone naming
- [ ] All tables created with proper structure and constraints
- [ ] RLS policies applied and tested
- [ ] Indexes created for performance optimization
- [ ] TypeScript types regenerated and include new tables
- [ ] Foreign key relationships working correctly
- [ ] Updated_at trigger functioning on subscriptions table

---

**Next Phase**: [Phase 2: API Routes & Server Actions](./stripe-integration-phase-2-api.md) 