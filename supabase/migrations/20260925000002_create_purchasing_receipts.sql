-- One row per faktur/invoice event received against a purchasing (PO). A
-- single PO can now be split across multiple receipts when the supplier
-- delivers/invoices it in separate fakturs (e.g. everything on one faktur
-- except one product that arrives on its own faktur later).
create table purchasing_receipts (
  id serial primary key,
  purchasing_id integer not null references purchasing (id) on delete cascade,
  invoice_no text,
  due_date date,
  total numeric(15, 2) not null default 0,
  warehouse_id integer references warehouses (id),
  created_by integer references users (id),
  created_at timestamptz not null default now()
);

alter table purchasing_receipts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'purchasing_receipts' and policyname = 'Authenticated users can read purchasing_receipts') then
    create policy "Authenticated users can read purchasing_receipts" on purchasing_receipts for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_receipts' and policyname = 'Authenticated users can insert purchasing_receipts') then
    create policy "Authenticated users can insert purchasing_receipts" on purchasing_receipts for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_receipts' and policyname = 'Authenticated users can update purchasing_receipts') then
    create policy "Authenticated users can update purchasing_receipts" on purchasing_receipts for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'purchasing_receipts' and policyname = 'Authenticated users can delete purchasing_receipts') then
    create policy "Authenticated users can delete purchasing_receipts" on purchasing_receipts for delete to authenticated using (true);
  end if;
end $$;

create index if not exists purchasing_receipts_purchasing_id_idx on purchasing_receipts (purchasing_id);
