-- Document the existing `outflow` table (schema drift: it exists on the remote
-- project already but was never captured in a migration). This is a no-op on
-- structure if the table already matches; it only adds the missing RLS policy.
create table if not exists outflow (
  id bigint primary key generated always as identity,
  date date not null default current_date,
  category text,
  amount numeric(15,2) not null default 0,
  description text,
  purchasing_id bigint references purchasing (id),
  debt_loan_id bigint references debt_loan (id),
  paid_by bigint references users (id),
  created_at timestamptz not null default now()
);

alter table outflow enable row level security;

create policy "Authenticated full access outflow"
  on outflow for all to authenticated using (true) with check (true);

-- Allow free-text categories for operational outflow entries (e.g. "Plastik",
-- "Bensin") instead of a fixed whitelist.
alter table outflow drop constraint if exists outflow_category_check;

-- Kas awal: cash on hand recorded once per calendar date (store opening).
create table cash_openings (
  id bigint primary key generated always as identity,
  date date not null unique,
  amount numeric(15,2) not null default 0,
  created_by bigint references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cash_openings enable row level security;

create policy "Authenticated full access cash_openings"
  on cash_openings for all to authenticated using (true) with check (true);
