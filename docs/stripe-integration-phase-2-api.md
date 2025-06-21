# **Phase 2: API Routes & Server Actions**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 1](./stripe-integration-phase-1-database.md)**

---

## **Phase Overview**
Implement backend logic for Stripe integration following Transformo's established API route patterns and server action conventions, using official Stripe best practices.

**Duration**: 4-5 hours  
**Prerequisites**: Phase 1 completed, Stripe environment variables configured

**References**: 
- [Stripe Next.js Subscription Guide](https://stripe.com/docs/billing/subscriptions/build-subscriptions-nextjs)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Free Trials](https://stripe.com/docs/billing/subscriptions/trials)

---

## **📋 Phase 2 Checklist**

### **Environment Setup**
- [ ] Add Stripe keys to `.env.local`
- [ ] Install Stripe SDK
- [ ] Configure Stripe price IDs
- [ ] Test Stripe connection

### **Server Actions**
- [ ] Create billing server actions file
- [ ] Implement create checkout session action
- [ ] Implement create portal session action
- [ ] Add subscription status utility functions
- [ ] Follow app's server action patterns

### **API Routes**
- [ ] Create Stripe webhook handler
- [ ] Implement webhook signature verification
- [ ] Add event idempotency checking
- [ ] Handle all required webhook events
- [ ] Follow app's API route patterns

### **Utility Functions**
- [ ] Create Stripe utility library
- [ ] Add subscription status helpers
- [ ] Add access control utilities
- [ ] Follow app's lib structure

### **Validation**
- [ ] Test webhook events with Stripe CLI
- [ ] Verify server actions work correctly
- [ ] Test subscription status checking
- [ ] Confirm error handling

---

## **1. Environment Setup**

### **1.1 Install Dependencies**

```bash
# Install Stripe SDK (latest version)
npm install stripe @stripe/stripe-js

# Install date utilities for subscription calculations
npm install date-fns
```

### **1.2 Environment Variables**

Add to `.env.local` following app's environment patterns:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...

# Stripe Product Configuration
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...

# App URLs for redirects
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### **1.3 Stripe Configuration File**

Create `lib/stripe.ts` following app's lib structure:

```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-12-18.acacia', // Use latest API version
  typescript: true,
});

// Price configuration
export const STRIPE_CONFIG = {
  MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID!,
  YEARLY_PRICE_ID: process.env.STRIPE_YEARLY_PRICE_ID!,
  TRIAL_PERIOD_DAYS: 7,
} as const;

// Verify price IDs are configured
if (!STRIPE_CONFIG.MONTHLY_PRICE_ID || !STRIPE_CONFIG.YEARLY_PRICE_ID) {
  console.warn('Stripe price IDs not configured. Set STRIPE_MONTHLY_PRICE_ID and STRIPE_YEARLY_PRICE_ID in environment variables.');
}
```

---

## **2. Server Actions Implementation**

### **2.1 Create Billing Actions File**

Create `app/actions/billing.ts` following app's server action patterns:

```typescript
'use server';

import { createClient } from '@/utils/supabase/server';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Tables } from '@/types/supabase';

type PlanType = 'monthly' | 'yearly';

// Utility function to get user's business
async function getUserBusiness() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Authentication required');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.business_id) {
    throw new Error('Business profile not found');
  }

  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', profile.business_id)
    .single();

  if (businessError || !business) {
    throw new Error('Business not found');
  }

  return { business, user };
}

// Create Stripe customer if needed
async function ensureStripeCustomer(business: Tables<'businesses'>, userEmail: string) {
  if (business.stripe_customer_id) {
    return business.stripe_customer_id;
  }

  // Create Stripe customer with proper metadata
  const customer = await stripe.customers.create({
    email: userEmail,
    name: business.business_name,
    metadata: {
      business_id: business.id,
      supabase_business_id: business.id, // Backup reference
    },
  });

  // Update business with Stripe customer ID using service role
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('businesses')
    .update({ stripe_customer_id: customer.id })
    .eq('id', business.id);

  if (updateError) {
    // Clean up Stripe customer if we can't save to database
    await stripe.customers.del(customer.id);
    throw new Error('Failed to save Stripe customer ID');
  }

  return customer.id;
}

// Create checkout session for subscription
export async function createCheckoutSession(plan: PlanType) {
  try {
    const { business, user } = await getUserBusiness();
    
    // Ensure Stripe customer exists
    const customerId = await ensureStripeCustomer(business, user.email!);
    
    // Get price ID based on plan
    const priceId = plan === 'monthly' 
      ? STRIPE_CONFIG.MONTHLY_PRICE_ID 
      : STRIPE_CONFIG.YEARLY_PRICE_ID;

    if (!priceId) {
      throw new Error(`Price ID not configured for ${plan} plan`);
    }

    // Check if customer already has an active subscription
    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (existingSubscriptions.data.length > 0) {
      return { 
        success: false, 
        error: 'Customer already has an active subscription' 
      };
    }

    // Create checkout session following Stripe best practices
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: STRIPE_CONFIG.TRIAL_PERIOD_DAYS,
        metadata: {
          business_id: business.id,
          created_by: user.id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?canceled=true`,
      metadata: {
        business_id: business.id,
        user_id: user.id,
      },
      allow_promotion_codes: true, // Allow discount codes
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
    });

    if (!session.url) {
      throw new Error('Failed to create checkout session URL');
    }

    return { success: true, url: session.url };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create checkout session' 
    };
  }
}

// Create portal session for subscription management
export async function createPortalSession() {
  try {
    const { business } = await getUserBusiness();
    
    if (!business.stripe_customer_id) {
      throw new Error('No Stripe customer found. Please contact support.');
    }

    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(business.stripe_customer_id);
    } catch (error) {
      throw new Error('Stripe customer not found. Please contact support.');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: business.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing`,
    });

    return { success: true, url: session.url };
  } catch (error) {
    console.error('Error creating portal session:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to access billing portal' 
    };
  }
}

// Get subscription status for current user's business
export async function getSubscriptionStatus() {
  try {
    const { business } = await getUserBusiness();
    
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('business_id', business.id)
      .single();

    if (error && error.code !== 'PGRST116') { // Not found error is OK
      throw error;
    }

    return { success: true, subscription };
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get subscription status' 
    };
  }
}

// Cancel subscription (sets to cancel at period end)
export async function cancelSubscription() {
  try {
    const { business } = await getUserBusiness();
    
    const supabase = await createClient();
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('business_id', business.id)
      .single();

    if (error || !subscription) {
      throw new Error('No active subscription found');
    }

    // Cancel at period end (user keeps access until end of billing period)
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    revalidatePath('/billing');
    
    return { success: true };
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to cancel subscription' 
    };
  }
}
```

### **2.2 Subscription Status Utilities**

Create `lib/subscription.ts`:

```typescript
import { Tables } from '@/types/supabase';

export type SubscriptionStatus = 'no_subscription' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'access_denied';

export interface AccessCheckResult {
  hasAccess: boolean;
  status: SubscriptionStatus;
  daysLeft?: number;
  message?: string;
  showBanner?: boolean;
  bannerType?: 'trial' | 'grace_period' | 'expired';
}

// Check if user has access based on subscription status
export function checkSubscriptionAccess(subscription: Tables<'subscriptions'> | null): AccessCheckResult {
  // No subscription found
  if (!subscription) {
    return {
      hasAccess: false,
      status: 'no_subscription',
      message: 'Start your 7-day free trial to access all features',
    };
  }

  const now = new Date();
  const currentPeriodEnd = new Date(subscription.current_period_end);
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;

  switch (subscription.status) {
    case 'trialing':
      if (trialEnd) {
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'trialing',
          daysLeft: Math.max(0, daysLeft),
          showBanner: daysLeft <= 3, // Show banner in last 3 days of trial
          bannerType: 'trial',
          message: daysLeft > 0 
            ? `${Math.max(0, daysLeft)} days left in your free trial`
            : 'Your free trial has ended',
        };
      }
      return {
        hasAccess: true,
        status: 'trialing',
        showBanner: true,
        bannerType: 'trial',
        message: 'Free trial active',
      };

    case 'active':
      return {
        hasAccess: true,
        status: 'active',
      };

    case 'past_due':
      // 7-day grace period from current period end
      const gracePeriodEnd = new Date(currentPeriodEnd.getTime() + (7 * 24 * 60 * 60 * 1000));
      if (now < gracePeriodEnd) {
        const daysLeft = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'past_due',
          daysLeft: Math.max(0, daysLeft),
          showBanner: true,
          bannerType: 'grace_period',
          message: `Payment failed. Update your payment method within ${Math.max(0, daysLeft)} days to maintain access.`,
        };
      }
      // Grace period expired
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Access suspended due to payment failure. Please update your payment method.',
      };

    case 'canceled':
      // Access until end of current period
      if (now < currentPeriodEnd) {
        const daysLeft = Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return {
          hasAccess: true,
          status: 'canceled',
          daysLeft: Math.max(0, daysLeft),
          showBanner: true,
          bannerType: 'expired',
          message: `Subscription canceled. Access ends in ${Math.max(0, daysLeft)} days.`,
        };
      }
      // Period ended
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription expired. Please subscribe to continue using the platform.',
      };

    case 'incomplete':
    case 'incomplete_expired':
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Payment incomplete. Please complete your subscription setup.',
      };

    case 'unpaid':
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription unpaid. Please update your payment method.',
      };

    default:
      return {
        hasAccess: false,
        status: 'access_denied',
        message: 'Subscription status unknown. Please contact support.',
      };
  }
}

// Get plan display name from price ID
export function getPlanName(priceId: string): string {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID) {
    return 'Monthly Plan';
  }
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID) {
    return 'Yearly Plan';
  }
  return 'Unknown Plan';
}

// Calculate savings for yearly plan
export function calculateYearlySavings(): { monthlyTotal: number; yearlyPrice: number; savings: number; percentSavings: number } {
  const monthlyTotal = 199 * 12; // $199 × 12 months
  const yearlyPrice = 1990; // $1990 yearly
  const savings = monthlyTotal - yearlyPrice;
  const percentSavings = Math.round((savings / monthlyTotal) * 100);
  
  return {
    monthlyTotal,
    yearlyPrice,
    savings,
    percentSavings,
  };
}

// Format price for display
export function formatPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
```

---

## **3. API Routes Implementation**

### **3.1 Webhook Handler**

Create `app/api/stripe/webhooks/route.ts` following Stripe security best practices:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Create admin Supabase client for webhook operations
function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Check if event was already processed (idempotency)
async function isEventProcessed(eventId: string): Promise<boolean> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single();

  return !error && !!data;
}

// Mark event as processed
async function markEventProcessed(eventId: string, eventType: string, eventData?: any): Promise<void> {
  const supabase = createAdminClient();
  
  const { error } = await supabase
    .from('stripe_events')
    .insert({
      stripe_event_id: eventId,
      event_type: eventType,
      event_data: eventData,
    });

  if (error) {
    console.error('Error marking event as processed:', error);
    throw error;
  }
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (!session.subscription || !session.customer) {
    throw new Error('Invalid checkout session: missing subscription or customer');
  }

  const supabase = createAdminClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string, {
    expand: ['items.data.price']
  });
  
  const businessId = session.metadata?.business_id;

  if (!businessId) {
    throw new Error('Missing business_id in session metadata');
  }

  // Create subscription record
  const { error } = await supabase
    .from('subscriptions')
    .insert({
      business_id: businessId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    });

  if (error) {
    throw new Error(`Failed to create subscription record: ${error.message}`);
  }

  console.log(`Subscription created for business ${businessId}: ${subscription.id}`);
}

// Handle invoice.paid
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription) return;

  const supabase = createAdminClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  // Update subscription record
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription record: ${error.message}`);
  }

  console.log(`Invoice paid for subscription: ${subscription.id}`);
}

// Handle invoice.payment_failed
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  if (!invoice.subscription) return;

  const supabase = createAdminClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);

  // Update subscription to past_due status
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status, // Should be 'past_due'
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription status: ${error.message}`);
  }

  console.log(`Payment failed for subscription: ${subscription.id}`);
}

// Handle customer.subscription.updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = createAdminClient();

  // Update subscription record
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`Subscription updated: ${subscription.id} - Status: ${subscription.status}`);
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const supabase = createAdminClient();

  // Update subscription status to canceled
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to mark subscription as canceled: ${error.message}`);
  }

  console.log(`Subscription deleted: ${subscription.id}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_WEBHOOK_SIGNING_SECRET) {
      console.error('Missing STRIPE_WEBHOOK_SIGNING_SECRET');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SIGNING_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (await isEventProcessed(event.id)) {
      console.log(`Event ${event.id} already processed, skipping`);
      return NextResponse.json({ received: true });
    }

    // Process the event
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      await markEventProcessed(event.id, event.type, event.data);

      return NextResponse.json({ received: true });
    } catch (error) {
      console.error(`Error processing webhook event ${event.id}:`, error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## **4. Testing Setup**

### **4.1 Stripe CLI Setup**

```bash
# Install Stripe CLI
# macOS: brew install stripe/stripe-cli/stripe
# Windows: Download from https://github.com/stripe/stripe-cli/releases

# Login to Stripe CLI
stripe login

# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# Copy the webhook signing secret from CLI output to .env.local
# STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
```

### **4.2 Test Webhook Events**

```bash
# Test specific events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted

# Test with specific data
stripe trigger checkout.session.completed --add checkout_session:metadata[business_id]=test-business-id
```

### **4.3 Local Testing Checklist**

```bash
# 1. Verify webhook endpoint responds
curl -X POST http://localhost:3000/api/stripe/webhooks

# 2. Test checkout session creation
# Navigate to /billing and try creating a subscription

# 3. Test portal access
# Create a subscription then access the portal

# 4. Verify database updates
# Check subscriptions table after webhook events
```

---

## **✅ Phase 2 Completion Criteria**

Before moving to Phase 3, verify:

- [ ] Environment variables configured correctly
- [ ] Stripe SDK properly initialized with latest API version
- [ ] Server actions handle subscription operations
- [ ] Webhook handler processes all required events
- [ ] Event idempotency working correctly
- [ ] Subscription status utilities function properly
- [ ] Error handling covers edge cases
- [ ] Webhook signature verification passes
- [ ] Customer portal integration works
- [ ] Free trial setup correctly configured
- [ ] All Stripe API calls follow official documentation patterns

---

**Next Phase**: [Phase 3: UI Components & Forms](./stripe-integration-phase-3-ui.md) 