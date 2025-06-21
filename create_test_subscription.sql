INSERT INTO subscriptions (
  business_id,
  stripe_subscription_id,
  stripe_customer_id,
  status,
  price_id,
  current_period_start,
  current_period_end,
  trial_end,
  cancel_at_period_end,
  canceled_at
) VALUES (
  'd55de192-a15f-40eb-bbd8-35a9b206c802',
  'sub_test_manual_123',
  'cus_test_manual_123',
  'trialing',
  'price_monthly_test',
  NOW(),
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '7 days',
  false,
  NULL
);
