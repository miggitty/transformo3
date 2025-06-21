# **Phase 2: API Routes & Server Actions**

**← [Back to Main PRD](./stripe-integration-prd.md) | [← Phase 1](./stripe-integration-phase-1-database.md)**

---

## **Phase Overview**
Implement backend logic for Stripe integration following Transformo's established API route patterns and server action conventions.

**Duration**: 4-5 hours  
**Prerequisites**: Phase 1 completed, Stripe environment variables configured

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
# Install Stripe SDK
npm install stripe @stripe/stripe-js

# Install additional dependencies for webhook handling
npm install micro raw-body
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
  apiVersion: '2024-06-20',
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
  throw new Error('Stripe price IDs must be configured in environment variables');
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

  // Create Stripe customer
  const customer = await stripe.customers.create({
    email: userEmail,
    name: business.business_name,
    metadata: {
      business_id: business.id,
    },
  });

  // Update business with Stripe customer ID
  const supabase = await createClient();
  const { error: updateError } = await supabase
    .from('businesses')
    .update({ stripe_customer_id: customer.id })
    .eq('id', business.id);

  if (updateError) {
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

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
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
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/billing?canceled=true`,
      metadata: {
        business_id: business.id,
      },
    });

    if (!session.url) {
      throw new Error('Failed to create checkout session');
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
      throw new Error('No active subscription found');
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
          showBanner: true,
          bannerType: 'trial',
          message: `${Math.max(0, daysLeft)} days left in your free trial`,
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
      // 7-day grace period
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
  if (priceId === process.env.STRIPE_MONTHLY_PRICE_ID) {
    return 'Monthly Plan';
  }
  if (priceId === process.env.STRIPE_YEARLY_PRICE_ID) {
    return 'Yearly Plan';
  }
  return 'Unknown Plan';
}

// Calculate savings for yearly plan
export function calculateYearlySavings(): { monthlyTotal: number; yearlyPrice: number; savings: number } {
  const monthlyTotal = 199 * 12; // $199 × 12 months
  const yearlyPrice = 1990; // $1990 yearly
  const savings = monthlyTotal - yearlyPrice;
  
  return {
    monthlyTotal,
    yearlyPrice,
    savings,
  };
}
```

---

## **3. API Routes Implementation**

### **3.1 Webhook Handler**

Create `app/api/stripe/webhooks/route.ts` following app's API route patterns:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient } from '@/utils/supabase/server';
import Stripe from 'stripe';

// Create service role client for webhook operations
async function createServiceRoleClient() {
  return createClient(process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Check if event was already processed (idempotency)
async function isEventProcessed(eventId: string) {
  const supabase = await createServiceRoleClient();
  
  const { data, error } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .single();

  return !error && data;
}

// Mark event as processed
async function markEventProcessed(eventId: string, eventType: string, eventData?: any) {
  const supabase = await createServiceRoleClient();
  
  const { error } = await supabase
    .from('stripe_events')
    .insert({
      stripe_event_id: eventId,
      event_type: eventType,
      event_data: eventData,
    });

  if (error) {
    console.error('Error marking event as processed:', error);
  }
}

// Handle checkout.session.completed
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (!session.subscription || !session.customer) {
    throw new Error('Invalid checkout session: missing subscription or customer');
  }

  const supabase = await createServiceRoleClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
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
}

// Handle invoice.paid
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const supabase = await createServiceRoleClient();
  
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
}

// Handle invoice.payment_failed
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;

  const supabase = await createServiceRoleClient();
  
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
}

// Handle customer.subscription.updated
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = await createServiceRoleClient();

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
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = await createServiceRoleClient();

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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SIGNING_SECRET!
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
# Follow instructions at: https://stripe.com/docs/stripe-cli#install

# Login to Stripe CLI
stripe login

# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# Note the webhook signing secret and add it to .env.local
```

### **4.2 Test Webhook Events**

```bash
# Test checkout session completed
stripe trigger checkout.session.completed

# Test invoice paid
stripe trigger invoice.paid

# Test payment failed
stripe trigger invoice.payment_failed
```

---

## **✅ Phase 2 Completion Criteria**

Before moving to Phase 3, verify:

- [ ] Environment variables configured correctly
- [ ] Stripe SDK properly initialized
- [ ] Server actions handle subscription operations
- [ ] Webhook handler processes all required events
- [ ] Event idempotency working correctly
- [ ] Subscription status utilities function properly
- [ ] Error handling covers edge cases
- [ ] Webhook signature verification passes

---

**Next Phase**: [Phase 3: UI Components & Forms](./stripe-integration-phase-3-ui.md) 