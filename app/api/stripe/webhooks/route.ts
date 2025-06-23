/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';

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
async function handleCheckoutCompleted(session: any): Promise<void> {
  console.log('🔍 Session object keys:', Object.keys(session));
  console.log('💳 Customer:', session.customer);
  console.log('📋 Subscription:', session.subscription);
  console.log('📊 Metadata:', session.metadata);
  
  if (!session.subscription || !session.customer) {
    console.error('❌ Session missing required fields:', {
      hasSubscription: !!session.subscription,
      hasCustomer: !!session.customer,
      sessionId: session.id
    });
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

  // Verify business exists
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .single();

  if (businessError || !business) {
    console.error('❌ Business not found:', {
      businessId,
      error: businessError?.message
    });
    throw new Error(`Business not found: ${businessId}`);
  }

  console.log('✅ Business verified:', businessId);

  // Create subscription record
  const subscriptionItem = (subscription as any).items.data[0];
  
  const subscriptionData = {
    business_id: businessId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status,
    price_id: subscriptionItem.price.id,
    current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
    trial_end: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000).toISOString() : null,
  };
  
  console.log('📝 Creating subscription with data:', subscriptionData);
  
  const { error } = await supabase
    .from('subscriptions')
    .insert(subscriptionData);

  if (error) {
    throw new Error(`Failed to create subscription record: ${error.message}`);
  }

  console.log(`Subscription created for business ${businessId}: ${subscription.id}`);
}

// Handle invoice.paid
async function handleInvoicePaid(invoice: any): Promise<void> {
  if (!(invoice as any).subscription) return;

  const supabase = createAdminClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);

  // Update subscription record
  const subscriptionItem = (subscription as any).items.data[0];
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
      trial_end: (subscription as any).trial_end ? new Date((subscription as any).trial_end * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription record: ${error.message}`);
  }

  console.log(`Invoice paid for subscription: ${subscription.id}`);
}

// Handle invoice.payment_failed
async function handlePaymentFailed(invoice: any): Promise<void> {
  if (!(invoice as any).subscription) return;

  const supabase = createAdminClient();
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);

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
async function handleSubscriptionUpdated(subscription: any): Promise<void> {
  const supabase = createAdminClient();

  // Update subscription record
  const subscriptionItem = subscription.items.data[0];
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      price_id: subscriptionItem.price.id,
      current_period_start: new Date(subscriptionItem.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscriptionItem.current_period_end * 1000).toISOString(),
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }

  console.log(`Subscription updated: ${subscription.id} - Status: ${subscription.status}`);
}

// Handle customer.subscription.deleted
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const supabase = createAdminClient();

  // Update subscription status to canceled
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    throw new Error(`Failed to mark subscription as canceled: ${error.message}`);
  }

  console.log(`Subscription deleted: ${subscription.id}`);
}

export async function POST(request: NextRequest) {
  console.log('🔥 Webhook received!', new Date().toISOString());
  
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');
    
    console.log('📦 Webhook body length:', body.length);
    console.log('🔑 Signature present:', !!signature);
    console.log('🌍 Webhook secret configured:', !!process.env.STRIPE_WEBHOOK_SIGNING_SECRET);

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
    let event: any;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SIGNING_SECRET
      );
      console.log('✅ Signature verified successfully');
      console.log('📨 Event type:', event.type);
      console.log('📊 Event ID:', event.id);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err);
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