-- Allow anon to read users.email for username→email lookup during login
create policy "anon can read users for login"
  on users for select
  to anon
  using (true);