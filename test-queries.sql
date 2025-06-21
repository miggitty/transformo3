-- Check user subscriptions
SELECT 
  p.email,
  b.business_name,
  s.status,
  s.current_period_start,
  s.current_period_end,
  s.trial_end,
  s.created_at
FROM profiles p
JOIN businesses b ON p.business_id = b.id
LEFT JOIN subscriptions s ON b.id = s.business_id
ORDER BY s.created_at DESC;

-- Check subscription by email
SELECT 
  s.*,
  b.business_name,
  p.email
FROM subscriptions s
JOIN businesses b ON s.business_id = b.id
JOIN profiles p ON p.business_id = b.id
WHERE p.email = 'test@example.com';

-- Simulate trial expiry (for testing)
UPDATE subscriptions 
SET trial_end = NOW() - INTERVAL '1 day'
WHERE stripe_subscription_id = 'sub_test_123';

-- Simulate past due status
UPDATE subscriptions 
SET 
  status = 'past_due',
  current_period_end = NOW() + INTERVAL '5 days'
WHERE stripe_subscription_id = 'sub_test_123';

-- Reset subscription for testing
UPDATE subscriptions 
SET 
  status = 'trialing',
  trial_end = NOW() + INTERVAL '7 days',
  current_period_end = NOW() + INTERVAL '7 days'
WHERE stripe_subscription_id = 'sub_test_123'; 