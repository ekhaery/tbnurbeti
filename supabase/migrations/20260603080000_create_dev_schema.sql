-- Create dev schema
create schema if not exists dev;

-- Grant usage to authenticated and anon roles
grant usage on schema dev to authenticated, anon;

-- =====================
-- ROLES
-- =====================
create table dev.roles (
  id serial primary key,
  name text not null unique
);
insert into dev.roles (name) values ('admin'), ('user');

-- =====================
-- USERS
-- =====================
create table dev.users (
  id serial primary key,
  name text not null,
  email text unique,
  role_id integer references dev.roles (id),
  auth_id uuid unique references auth.users (id) on delete set null
);

-- =====================
-- CATEGORIES
-- =====================
create table dev.categories (
  id serial primary key,
  name text not null unique,
  is_price_required boolean not null default true
);
insert into dev.categories (name, is_price_required) values
  ('Cat Tembok', false),
  ('Besi', true),
  ('Semen', true),
  ('Keramik', true),
  ('Kayu', true);

-- =====================
-- PRODUCTS
-- =====================
create table dev.products (
  id serial primary key,
  code text unique,
  name text not null,
  category_id integer references dev.categories (id),
  base_price numeric(15,2) not null default 0,
  price numeric(15,2) not null default 0,
  stock integer not null default 0,
  is_discontinued boolean not null default false,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

-- =====================
-- SUPPLIERS
-- =====================
create table dev.suppliers (
  id serial primary key,
  name text not null,
  phone text,
  address text,
  sales_name text,
  bank_detail jsonb,
  created_at timestamptz not null default now()
);

-- =====================
-- PURCHASING
-- =====================
create table dev.purchasing (
  id serial primary key,
  code text not null unique,
  supplier_id integer not null references dev.suppliers (id),
  date date not null default current_date,
  notes text,
  period integer not null default 0,
  total numeric(15,2) not null default 0,
  created_by integer references dev.users (id),
  created_at timestamptz not null default now()
);

create table dev.purchasing_items (
  id serial primary key,
  purchasing_id integer not null references dev.purchasing (id) on delete cascade,
  product_id integer not null references dev.products (id),
  qty integer not null check (qty > 0),
  base_price numeric(15,2) not null default 0
);

-- =====================
-- STOCK BATCHES
-- =====================
create table dev.stock_batches (
  id serial primary key,
  purchasing_item_id integer not null references dev.purchasing_items (id) on delete cascade,
  product_id integer not null references dev.products (id),
  qty_remaining integer not null check (qty_remaining >= 0),
  base_price numeric(15,2) not null default 0,
  received_at date not null default current_date
);

-- =====================
-- TRANSACTIONS
-- =====================
create table dev.transactions (
  id serial primary key,
  code text not null unique,
  date date not null default current_date,
  notes text,
  created_by integer references dev.users (id),
  created_at timestamptz not null default now()
);

create table dev.transaction_items (
  id serial primary key,
  transaction_id integer not null references dev.transactions (id) on delete cascade,
  product_id integer not null references dev.products (id),
  qty integer not null check (qty > 0),
  price_sold numeric(15,2) not null default 0,
  cogs numeric(15,2) not null default 0,
  profit numeric(15,2) generated always as (price_sold * qty - cogs) stored
);

create table dev.stock_batch_consumption (
  id serial primary key,
  transaction_item_id integer not null references dev.transaction_items (id) on delete cascade,
  stock_batch_id integer not null references dev.stock_batches (id),
  qty_consumed integer not null check (qty_consumed > 0)
);

-- =====================
-- BILLS
-- =====================
create table dev.bills (
  id serial primary key,
  purchasing_id integer not null references dev.purchasing (id) on delete cascade,
  supplier_id integer not null references dev.suppliers (id),
  due_date date not null,
  month varchar(20) not null,
  installment numeric(15,2) not null default 0,
  paid_amount numeric(15,2) not null default 0,
  is_paid boolean not null default false,
  bill_no text,
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function dev.bills_check_paid()
returns trigger as $$
begin
  if new.paid_amount >= new.installment then
    new.is_paid := true;
  else
    new.is_paid := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger bills_auto_paid
  before insert or update on dev.bills
  for each row execute function dev.bills_check_paid();

-- =====================
-- RLS — grant all authenticated users full access to dev schema
-- =====================
do $$
declare
  t text;
  tables text[] := array[
    'roles','users','categories','products','suppliers',
    'purchasing','purchasing_items','stock_batches',
    'transactions','transaction_items','stock_batch_consumption','bills'
  ];
begin
  foreach t in array tables loop
    execute format('alter table dev.%I enable row level security', t);
    execute format('grant all on dev.%I to authenticated', t);
    execute format(
      'create policy "dev full access %s" on dev.%I for all to authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end $$;

-- Grant sequence usage
grant usage, select on all sequences in schema dev to authenticated;
