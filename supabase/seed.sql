-- Create test user and business for webhook testing
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'test@example.com',
  '$2a$10$rOdJMIIHzWgWJPNKXKpNZeJJEpO8Zt.7ztHHbA8.jGEO.LZkzWzKW', -- password: test123456
  NOW(),
  NOW(),
  NOW(),
  '',
  ''
);

-- Create business
INSERT INTO businesses (
  id,
  business_name,
  contact_email,
  stripe_customer_id,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'Test Business',
  'test@example.com',
  'cus_SXVH3fyMKglvn2',
  NOW()
);

-- Create profile linking user to business
INSERT INTO profiles (
  id,
  business_id,
  is_admin
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
  true
);

-- Create subscription record
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
  canceled_at,
  created_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'sub_1RcQGjQPV2PhPt4iCzUoRmW1',
  'cus_SXVH3fyMKglvn2',
  'trialing',
  'price_1RcLp4QPV2PhPt4ijUdNhg3f',
  NOW(),
  NOW() + INTERVAL '1 month',
  '2025-06-28T12:11:37.000Z',
  false,
  NULL,
  NOW()
); 