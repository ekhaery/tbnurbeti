insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) values (
  gen_random_uuid(),
  'izah@tbnurbeti.com',
  extensions.crypt('izah123', extensions.gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  'authenticated'
);

insert into users (name, email, role_id, auth_id)
select
  'izah',
  'izah@tbnurbeti.com',
  2,
  id
from auth.users
where email = 'izah@tbnurbeti.com';