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
COMMENT ON COLUMN public.stripe_events.event_type IS 'Stripe event type (e.g., customer.subscription.updated)';
COMMENT ON COLUMN public.stripe_events.event_data IS 'Full Stripe event data for debugging and audit';
COMMENT ON COLUMN public.stripe_events.processing_status IS 'Whether event was processed successfully';
COMMENT ON COLUMN public.stripe_events.api_version IS 'Stripe API version when event was created';

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