-- add email and auth_id to users table
alter table users
  add column email text unique,
  add column auth_id uuid unique references auth.users (id) on delete set null;
