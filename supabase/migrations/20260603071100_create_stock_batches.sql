create table stock_batches (
  id serial primary key,
  purchasing_item_id integer not null references purchasing_items (id) on delete cascade,
  product_id integer not null references products (id),
  qty_remaining integer not null check (qty_remaining >= 0),
  base_price numeric(15, 2) not null default 0,
  received_at date not null default current_date
);

alter table stock_batches enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'stock_batches' and policyname = 'Authenticated users can read stock_batches') then
    create policy "Authenticated users can read stock_batches" on stock_batches for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_batches' and policyname = 'Authenticated users can insert stock_batches') then
    create policy "Authenticated users can insert stock_batches" on stock_batches for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'stock_batches' and policyname = 'Authenticated users can update stock_batches') then
    create policy "Authenticated users can update stock_batches" on stock_batches for update to authenticated using (true);
  end if;
end $$;
