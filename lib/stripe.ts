import Stripe from 'stripe';

// Initialize Stripe with a fallback for build time
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_for_build';

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil', // Use latest API version
  typescript: true,
});

// Price configuration
export const STRIPE_CONFIG = {
  MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID || 'price_placeholder_monthly',
  YEARLY_PRICE_ID: process.env.STRIPE_YEARLY_PRICE_ID || 'price_placeholder_yearly',
  TRIAL_PERIOD_DAYS: 7,
} as const;

// Runtime validation function
export function validateStripeConfig() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is required');
  }
  if (!process.env.STRIPE_MONTHLY_PRICE_ID || !process.env.STRIPE_YEARLY_PRICE_ID) {
    throw new Error('Stripe price IDs not configured. Set STRIPE_MONTHLY_PRICE_ID and STRIPE_YEARLY_PRICE_ID in environment variables.');
  }
} 