-- customer_receivables
create table customer_receivables (
  id serial primary key,
  customer_id integer not null references customers (id) on delete cascade,
  transaction_id integer references transactions (id) on delete set null,
  date date not null default current_date,
  due_date date,
  total numeric(15,2) not null default 0,
  remaining_amount numeric(15,2) not null default 0,
  status text not null default 'Belum Dibayar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customer_receivables enable row level security;
create policy "Authenticated full access customer_receivables"
  on customer_receivables for all to authenticated using (true) with check (true);

-- customer_receivables_detail
create table customer_receivables_detail (
  id serial primary key,
  customer_receivables_id integer not null references customer_receivables (id) on delete cascade,
  date date not null default current_date,
  amount numeric(15,2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table customer_receivables_detail enable row level security;
create policy "Authenticated full access customer_receivables_detail"
  on customer_receivables_detail for all to authenticated using (true) with check (true);
