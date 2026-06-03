create table categories (
  id bigint primary key generated always as identity,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table suppliers (
  id bigint primary key generated always as identity,
  name text not null,
  bank_account text,
  no_rek text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id bigint primary key generated always as identity,
  name text not null,
  category_id bigint not null references categories (id),
  supplier_id bigint references suppliers (id),
  base_price numeric not null,
  price numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
