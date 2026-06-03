create table transactions (
  id serial primary key,
  code text not null unique,
  date date not null default current_date,
  notes text,
  created_by integer references users (id),
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Authenticated users can read transactions') then
    create policy "Authenticated users can read transactions" on transactions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Authenticated users can insert transactions') then
    create policy "Authenticated users can insert transactions" on transactions for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transactions' and policyname = 'Authenticated users can update transactions') then
    create policy "Authenticated users can update transactions" on transactions for update to authenticated using (true);
  end if;
end $$;

-- transaction_items
create table transaction_items (
  id serial primary key,
  transaction_id integer not null references transactions (id) on delete cascade,
  product_id integer not null references products (id),
  qty integer not null check (qty > 0),
  price_sold numeric(15, 2) not null default 0,
  cogs numeric(15, 2) not null default 0,
  profit numeric(15, 2) generated always as (price_sold * qty - cogs) stored
);

alter table transaction_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'transaction_items' and policyname = 'Authenticated users can read transaction_items') then
    create policy "Authenticated users can read transaction_items" on transaction_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transaction_items' and policyname = 'Authenticated users can insert transaction_items') then
    create policy "Authenticated users can insert transaction_items" on transaction_items for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'transaction_items' and policyname = 'Authenticated users can update transaction_items') then
    create policy "Authenticated users can update transaction_items" on transaction_items for update to authenticated using (true);
  end if;
end $$;

-- stock_batch_consumption (FIFO audit trail)
create table stock_batch_consumption (
  id serial primary key,
  transaction_item_id integer not null references transaction_items (id) on delete cascade,
  stock_batch_id integer not null references stock_batches (id),
  qty_consumed integer not null check (qty_consumed > 0)
);

alter table stock_batch_consumption enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'stock_batch_consumption' and policyname = 'Authenticated users can read stock_batch_consumption') then
    create policy "Authenticated users can read stock_batch_consumption" on stock_batch_consumption for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_batch_consumption' and policyname = 'Authenticated users can insert stock_batch_consumption') then
    create policy "Authenticated users can insert stock_batch_consumption" on stock_batch_consumption for insert to authenticated with check (true);
  end if;
end $$;
