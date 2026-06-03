create extension if not exists pgcrypto schema extensions;

do $$
declare
  uid uuid;
begin

  -- faiz
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'faiz', extensions.crypt('faiz123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'faiz' where name = 'faiz';

  -- nisa
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'nisa', extensions.crypt('nisa123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'nisa' where name = 'nisa';

  -- fadel
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'fadel', extensions.crypt('fadel123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'fadel' where name = 'fadel';

  -- abah
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'abah', extensions.crypt('abah123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'abah' where name = 'abah';

  -- ibu
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'ibu', extensions.crypt('ibu123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'ibu' where name = 'ibu';

  -- fira
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'fira', extensions.crypt('fira123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'fira' where name = 'fira';

  -- supri
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'supri', extensions.crypt('supri123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'supri' where name = 'supri';

  -- indah
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'indah', extensions.crypt('indah123', extensions.gen_salt('bf')), now(), now(), now(), '', '', '', '');
  update users set auth_id = uid, email = 'indah' where name = 'indah';

end $$;
