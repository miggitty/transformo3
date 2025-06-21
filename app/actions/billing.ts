'use server';

import { createClient } from '@/utils/supabase/server';
import { stripe, STRIPE_CONFIG, validateStripeConfig } from '@/lib/stripe';
import { revalidatePath } from 'next/cache';
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
    validateStripeConfig();
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
    validateStripeConfig();
    const { business } = await getUserBusiness();
    
    if (!business.stripe_customer_id) {
      throw new Error('No Stripe customer found. Please contact support.');
    }

    // Verify customer exists in Stripe
    try {
      await stripe.customers.retrieve(business.stripe_customer_id);
    } catch {
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