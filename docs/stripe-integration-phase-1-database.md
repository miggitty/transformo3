# **Phase 1: Database Schema & Migrations**

**← [Back to Main PRD](./stripe-integration-prd.md)**

---

## **Phase Overview**
Set up the database foundation for Stripe integration following Transformo's established migration patterns and naming conventions, based on Stripe's best practices for subscription data modeling.

**Duration**: 2-3 hours  
**Prerequisites**: Understanding of Supabase migrations and Brisbane timezone naming

**References**:
- [Stripe Subscription Data Model](https://stripe.com/docs/api/subscriptions/object)
- [Stripe Customer Object](https://stripe.com/docs/api/customers/object)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)

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

# Option 2: Manual Brisbane timestamp (recommended for consistency)
timestamp=$(TZ=Australia/Brisbane date +"%Y%m%d%H%M%S")
touch "supabase/migrations/${timestamp}_add-stripe-subscription-schema.sql"
```

**Migration File Pattern**: `YYYYMMDDHHMMSS_add-stripe-subscription-schema.sql`

### **1.2 Migration File Structure**
The migration file should follow this pattern and include comprehensive documentation:

---

## **2. Database Schema Implementation**

### **2.1 Businesses Table Modification**

```sql
-- Add Stripe customer ID to businesses table
-- Following the pattern of other integration IDs (heygen_secret_id, email_secret_id)
ALTER TABLE public.businesses
ADD COLUMN stripe_customer_id TEXT UNIQUE;

-- Add comment for documentation
COMMENT ON COLUMN public.businesses.stripe_customer_id IS 'Stripe Customer ID (cus_...) for billing and subscription management';

-- Add constraint to ensure valid Stripe customer ID format
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_stripe_customer_id_format 
CHECK (stripe_customer_id IS NULL OR stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$');
```

### **2.2 Subscriptions Table Creation**

```sql
-- Create subscriptions table following app's table patterns and Stripe's data model
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key to businesses (following business-centric model)
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    
    -- Stripe-specific fields (based on Stripe Subscription object)
    stripe_subscription_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'trialing',           -- During trial period
        'active',            -- Active subscription
        'past_due',          -- Payment failed, in grace period
        'canceled',          -- Canceled but still has access until period end
        'incomplete',        -- Initial payment failed
        'incomplete_expired', -- Initial payment failed and expired
        'unpaid'            -- Payment failed beyond grace period
    )),
    
    -- Subscription details
    price_id TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one active subscription per business
    CONSTRAINT unique_business_subscription UNIQUE(business_id)
);

-- Add table comment
COMMENT ON TABLE public.subscriptions IS 'Stores Stripe subscription data synced via webhooks. Follows Stripe Subscription object structure.';

-- Add column comments for clarity
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID (cus_...) - denormalized for quick lookups';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status from Stripe - maps to Stripe subscription statuses';
COMMENT ON COLUMN public.subscriptions.price_id IS 'Stripe price ID (price_...) for current plan';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'End of current billing period';
COMMENT ON COLUMN public.subscriptions.trial_end IS 'End of trial period (null if no trial)';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Whether subscription is set to cancel at period end';
COMMENT ON COLUMN public.subscriptions.canceled_at IS 'When subscription was canceled (if applicable)';

-- Add constraints for Stripe ID formats
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_stripe_subscription_id_format 
CHECK (stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$');

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_stripe_customer_id_format 
CHECK (stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$');

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_price_id_format 
CHECK (price_id ~ '^price_[a-zA-Z0-9]+$');

-- Add constraint to ensure trial_end is before or equal to current_period_end
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_trial_end_check 
CHECK (trial_end IS NULL OR trial_end <= current_period_end);

-- Add constraint to ensure period dates are logical
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_period_dates_check 
CHECK (current_period_start < current_period_end);
```

### **2.3 Stripe Events Table Creation**

```sql
-- Create table for webhook event tracking (idempotency)
-- Based on Stripe's webhook best practices
CREATE TABLE public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Stripe event details
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Store event data for debugging and audit trail
    event_data JSONB,
    
    -- Processing status
    processing_status TEXT DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed', 'skipped')),
    error_message TEXT,
    
    -- API version for compatibility tracking
    api_version TEXT
);

-- Add table comment
COMMENT ON TABLE public.stripe_events IS 'Tracks processed Stripe webhook events for idempotency and audit trail';

-- Add column comments
COMMENT ON COLUMN public.stripe_events.stripe_event_id IS 'Stripe event ID (evt_...) for idempotency checking';
COMMENT ON COLUMN public.stripe_events.event_type IS 'Stripe event type (e.g., customer.subscription.updated)';
COMMENT ON COLUMN public.stripe_events.event_data IS 'Full Stripe event data for debugging and audit';
COMMENT ON COLUMN public.stripe_events.processing_status IS 'Whether event was processed successfully';
COMMENT ON COLUMN public.stripe_events.api_version IS 'Stripe API version when event was created';

-- Add constraint for Stripe event ID format
ALTER TABLE public.stripe_events 
ADD CONSTRAINT stripe_events_event_id_format 
CHECK (stripe_event_id ~ '^evt_[a-zA-Z0-9]+$');
```

### **2.4 Indexes for Performance**

```sql
-- Add indexes following app's performance patterns and Stripe query patterns
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_trial_end ON public.subscriptions(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX idx_subscriptions_cancel_at_period_end ON public.subscriptions(cancel_at_period_end) WHERE cancel_at_period_end = TRUE;

-- Indexes for stripe_events table
CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at);
CREATE INDEX idx_stripe_events_event_type ON public.stripe_events(event_type);
CREATE INDEX idx_stripe_events_processing_status ON public.stripe_events(processing_status);

-- Composite index for common subscription queries
CREATE INDEX idx_subscriptions_business_status ON public.subscriptions(business_id, status);

-- Index for webhook event cleanup (old events)
CREATE INDEX idx_stripe_events_created_at_desc ON public.stripe_events(created_at DESC);
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

-- Policy for service role (for webhook handlers and admin operations)
CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
    FOR ALL TO service_role USING (true);

-- Read-only policy for authenticated users (for additional safety)
CREATE POLICY "Users can read their business subscription" ON public.subscriptions
    FOR SELECT USING (
        business_id IN (
            SELECT business_id FROM public.profiles 
            WHERE id = auth.uid()
        )
    );
```

### **3.3 RLS Policies for Stripe Events**

```sql
-- Policy for service role only (webhook handlers and admin)
CREATE POLICY "Service role can manage stripe events" ON public.stripe_events
    FOR ALL TO service_role USING (true);

-- No authenticated user access needed for stripe_events table
-- This table is purely for webhook processing and admin audit trail
```

---

## **4. Trigger Functions**

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

-- Add comment for documentation
COMMENT ON FUNCTION update_subscriptions_updated_at() IS 'Automatically updates updated_at timestamp when subscription is modified';
```

### **4.2 Subscription Status Change Logging (Optional)**

```sql
-- Create function to log subscription status changes
CREATE OR REPLACE FUNCTION log_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.stripe_events (
            stripe_event_id,
            event_type,
            event_data,
            processing_status
        ) VALUES (
            'internal_' || NEW.id || '_' || extract(epoch from now())::text,
            'subscription.status_changed',
            jsonb_build_object(
                'subscription_id', NEW.stripe_subscription_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'changed_at', NEW.updated_at,
                'business_id', NEW.business_id
            ),
            'processed'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status change logging
CREATE TRIGGER subscription_status_change_trigger
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_status_change();

-- Add comment
COMMENT ON FUNCTION log_subscription_status_change() IS 'Logs subscription status changes for audit trail';
```

---

## **5. Complete Migration File**

### **5.1 Full Migration Script**

```sql
-- =================================================================
--          Stripe Subscription Integration Migration
-- =================================================================
-- This migration adds Stripe subscription support following
-- Transformo's established patterns and Stripe best practices.
-- 
-- References:
-- - Stripe Subscription API: https://stripe.com/docs/api/subscriptions
-- - Stripe Webhooks: https://stripe.com/docs/webhooks
-- =================================================================

-- Step 1: Add Stripe customer ID to businesses table
-- -----------------------------------------------------------------
ALTER TABLE public.businesses
ADD COLUMN stripe_customer_id TEXT UNIQUE;

COMMENT ON COLUMN public.businesses.stripe_customer_id IS 'Stripe Customer ID (cus_...) for billing and subscription management';

-- Add constraint for Stripe customer ID format
ALTER TABLE public.businesses 
ADD CONSTRAINT businesses_stripe_customer_id_format 
CHECK (stripe_customer_id IS NULL OR stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$');

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
    status TEXT NOT NULL CHECK (status IN (
        'trialing', 'active', 'past_due', 'canceled', 
        'incomplete', 'incomplete_expired', 'unpaid'
    )),
    
    -- Subscription details
    price_id TEXT NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one subscription per business
    CONSTRAINT unique_business_subscription UNIQUE(business_id)
);

-- Add comments
COMMENT ON TABLE public.subscriptions IS 'Stores Stripe subscription data synced via webhooks';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'Stripe subscription ID (sub_...)';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'Stripe customer ID (cus_...) - denormalized for quick lookups';
COMMENT ON COLUMN public.subscriptions.status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN public.subscriptions.price_id IS 'Stripe price ID (price_...) for current plan';

-- Add constraints for Stripe ID formats
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_stripe_subscription_id_format 
CHECK (stripe_subscription_id ~ '^sub_[a-zA-Z0-9]+$');

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_stripe_customer_id_format 
CHECK (stripe_customer_id ~ '^cus_[a-zA-Z0-9]+$');

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_price_id_format 
CHECK (price_id ~ '^price_[a-zA-Z0-9]+$');

-- Add logical constraints
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_trial_end_check 
CHECK (trial_end IS NULL OR trial_end <= current_period_end);

ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_period_dates_check 
CHECK (current_period_start < current_period_end);

-- Step 3: Create stripe_events table for webhook idempotency
-- -----------------------------------------------------------------
CREATE TABLE public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Stripe event details
    stripe_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Store event data for debugging
    event_data JSONB,
    processing_status TEXT DEFAULT 'processed' CHECK (processing_status IN ('processed', 'failed', 'skipped')),
    error_message TEXT,
    api_version TEXT
);

-- Add comments
COMMENT ON TABLE public.stripe_events IS 'Tracks processed Stripe webhook events for idempotency';
COMMENT ON COLUMN public.stripe_events.stripe_event_id IS 'Stripe event ID (evt_...) for idempotency checking';

-- Add constraint for Stripe event ID format
ALTER TABLE public.stripe_events 
ADD CONSTRAINT stripe_events_event_id_format 
CHECK (stripe_event_id ~ '^evt_[a-zA-Z0-9]+$');

-- Step 4: Create indexes for performance
-- -----------------------------------------------------------------
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON public.subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_trial_end ON public.subscriptions(trial_end) WHERE trial_end IS NOT NULL;
CREATE INDEX idx_subscriptions_business_status ON public.subscriptions(business_id, status);

CREATE INDEX idx_stripe_events_event_id ON public.stripe_events(stripe_event_id);
CREATE INDEX idx_stripe_events_created_at ON public.stripe_events(created_at);
CREATE INDEX idx_stripe_events_event_type ON public.stripe_events(event_type);
CREATE INDEX idx_stripe_events_processing_status ON public.stripe_events(processing_status);

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

CREATE TRIGGER update_subscriptions_updated_at_trigger
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscriptions_updated_at();

-- Step 8: Create status change logging function (optional)
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_subscription_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.stripe_events (
            stripe_event_id,
            event_type,
            event_data,
            processing_status
        ) VALUES (
            'internal_' || NEW.id || '_' || extract(epoch from now())::text,
            'subscription.status_changed',
            jsonb_build_object(
                'subscription_id', NEW.stripe_subscription_id,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'changed_at', NEW.updated_at,
                'business_id', NEW.business_id
            ),
            'processed'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscription_status_change_trigger
    AFTER UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_status_change();

-- Add function comments
COMMENT ON FUNCTION update_subscriptions_updated_at() IS 'Automatically updates updated_at timestamp when subscription is modified';
COMMENT ON FUNCTION log_subscription_status_change() IS 'Logs subscription status changes for audit trail';
```

---

## **6. Running the Migration**

### **6.1 Execute Migration**

```bash
# Push migration to local Supabase
supabase db push

# Verify migration was applied
supabase db diff

# Check for any issues
supabase status
```

### **6.2 Generate Updated Types**

```bash
# Generate new TypeScript types including new tables
npx supabase gen types typescript --local > types/supabase.ts

# Verify types were generated correctly
grep -A 10 "subscriptions" types/supabase.ts
grep -A 10 "stripe_events" types/supabase.ts
```

### **6.3 Verify Schema**

```sql
-- Check that tables were created correctly
\d+ public.subscriptions
\d+ public.stripe_events

-- Verify RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('subscriptions', 'stripe_events');

-- Check indexes
SELECT indexname, tablename, indexdef 
FROM pg_indexes 
WHERE tablename IN ('subscriptions', 'stripe_events');

-- Verify constraints
SELECT conname, contype, confrelid::regclass, conkey, confkey 
FROM pg_constraint 
WHERE conrelid IN ('public.subscriptions'::regclass, 'public.stripe_events'::regclass);
```

---

## **7. Testing & Validation**

### **7.1 Test RLS Policies**

```sql
-- Test as authenticated user (should only see their business subscription)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "test-user-id"}';
SELECT * FROM subscriptions; -- Should return empty or only user's business data

-- Test as service role (should see all)
RESET ROLE;
SET ROLE service_role;
SELECT * FROM subscriptions; -- Should have full access
RESET ROLE;
```

### **7.2 Test Foreign Key Constraints**

```sql
-- Test that invalid business_id is rejected
INSERT INTO subscriptions (
    business_id, 
    stripe_subscription_id, 
    stripe_customer_id, 
    status, 
    price_id, 
    current_period_start, 
    current_period_end
) VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'sub_test123', 
    'cus_test123', 
    'active', 
    'price_test123', 
    NOW(), 
    NOW() + INTERVAL '1 month'
);
-- Should fail with foreign key constraint error
```

### **7.3 Test Constraints**

```sql
-- Test Stripe ID format constraints
INSERT INTO subscriptions (
    business_id, 
    stripe_subscription_id, 
    stripe_customer_id, 
    status, 
    price_id, 
    current_period_start, 
    current_period_end
) VALUES (
    (SELECT id FROM businesses LIMIT 1),
    'invalid_id', -- Should fail format check
    'cus_test123', 
    'active', 
    'price_test123', 
    NOW(), 
    NOW() + INTERVAL '1 month'
);
-- Should fail with constraint error

-- Test period dates constraint
INSERT INTO subscriptions (
    business_id, 
    stripe_subscription_id, 
    stripe_customer_id, 
    status, 
    price_id, 
    current_period_start, 
    current_period_end
) VALUES (
    (SELECT id FROM businesses LIMIT 1),
    'sub_test123', 
    'cus_test123', 
    'active', 
    'price_test123', 
    NOW() + INTERVAL '1 month', -- Start after end
    NOW()
);
-- Should fail with period dates constraint
```

---

## **✅ Phase 1 Completion Criteria**

Before moving to Phase 2, verify:

- [ ] Migration file created with correct Brisbane timezone naming
- [ ] All tables created with proper structure and constraints
- [ ] Stripe ID format constraints working correctly
- [ ] RLS policies applied and tested
- [ ] Indexes created for performance optimization
- [ ] TypeScript types regenerated and include new tables
- [ ] Foreign key relationships working correctly
- [ ] Updated_at trigger functioning on subscriptions table
- [ ] Status change logging trigger working (optional)
- [ ] All constraints properly tested
- [ ] Database schema follows Stripe's data model patterns
- [ ] Webhook idempotency table ready for event processing

---

**Next Phase**: [Phase 2: API Routes & Server Actions](./stripe-integration-phase-2-api.md) 