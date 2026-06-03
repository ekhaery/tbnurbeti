create table purchasing (
  id serial primary key,
  code text not null unique,
  supplier_id integer not null references suppliers (id),
  date date not null default current_date,
  notes text,
  created_by integer references users (id),
  created_at timestamptz not null default now()
);

alter table purchasing enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'purchasing' and policyname = 'Authenticated users can read purchasing') then
    create policy "Authenticated users can read purchasing" on purchasing for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing' and policyname = 'Authenticated users can insert purchasing') then
    create policy "Authenticated users can insert purchasing" on purchasing for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing' and policyname = 'Authenticated users can update purchasing') then
    create policy "Authenticated users can update purchasing" on purchasing for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing' and policyname = 'Authenticated users can delete purchasing') then
    create policy "Authenticated users can delete purchasing" on purchasing for delete to authenticated using (true);
  end if;
end $$;

-- purchasing_items
create table purchasing_items (
  id serial primary key,
  purchasing_id integer not null references purchasing (id) on delete cascade,
  product_id integer not null references products (id),
  qty integer not null check (qty > 0),
  base_price numeric(15, 2) not null default 0
);

alter table purchasing_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'purchasing_items' and policyname = 'Authenticated users can read purchasing_items') then
    create policy "Authenticated users can read purchasing_items" on purchasing_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_items' and policyname = 'Authenticated users can insert purchasing_items') then
    create policy "Authenticated users can insert purchasing_items" on purchasing_items for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_items' and policyname = 'Authenticated users can update purchasing_items') then
    create policy "Authenticated users can update purchasing_items" on purchasing_items for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_items' and policyname = 'Authenticated users can delete purchasing_items') then
    create policy "Authenticated users can delete purchasing_items" on purchasing_items for delete to authenticated using (true);
  end if;
end $$;
