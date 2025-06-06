-- Seed script to create initial admin user

insert into auth.users (id, email, encrypted_password, instance_id, aud, role, email_confirmed_at, confirmation_sent_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, last_sign_in_at, phone, phone_confirmed_at, confirmation_token, email_change, email_change_token_new, recovery_token, email_change_confirm_status)
values (
  gen_random_uuid(),
  'marlon@enzango.com',
  '',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  now(),
  now(),
  '{}',
  '{}',
  false,
  now(),
  now(),
  now(),
  null,
  null,
  null,
  null,
  null,
  null,
  0
) on conflict do nothing;

insert into profiles (id, is_admin)
select id, true from auth.users where email = 'marlon@enzango.com'; 