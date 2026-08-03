create table if not exists warehouses (
  id serial primary key,
  name text not null,
  code text not null unique,
  type text not null check (type in ('warehouse', 'store', 'rack', 'bin')),
  parent_id integer references warehouses (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table warehouses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'warehouses' and policyname = 'Authenticated users can read warehouses') then
    create policy "Authenticated users can read warehouses" on warehouses for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'warehouses' and policyname = 'Authenticated users can insert warehouses') then
    create policy "Authenticated users can insert warehouses" on warehouses for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'warehouses' and policyname = 'Authenticated users can update warehouses') then
    create policy "Authenticated users can update warehouses" on warehouses for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'warehouses' and policyname = 'Authenticated users can delete warehouses') then
    create policy "Authenticated users can delete warehouses" on warehouses for delete to authenticated using (true);
  end if;
end $$;
