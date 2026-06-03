-- enable RLS
alter table categories enable row level security;
alter table products enable row level security;
alter table suppliers enable row level security;
alter table roles enable row level security;
alter table users enable row level security;

-- categories: authenticated users can read
create policy "authenticated can read categories"
  on categories for select
  to authenticated
  using (true);

-- products: authenticated users can read and insert
create policy "authenticated can read products"
  on products for select
  to authenticated
  using (true);

create policy "authenticated can insert products"
  on products for insert
  to authenticated
  with check (true);

-- roles: authenticated users can read
create policy "authenticated can read roles"
  on roles for select
  to authenticated
  using (true);

-- users: authenticated users can read
create policy "authenticated can read users"
  on users for select
  to authenticated
  using (true);
