create table if not exists suppliers (
  id serial primary key,
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

alter table suppliers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Authenticated users can read suppliers') then
    create policy "Authenticated users can read suppliers" on suppliers for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Authenticated users can insert suppliers') then
    create policy "Authenticated users can insert suppliers" on suppliers for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Authenticated users can update suppliers') then
    create policy "Authenticated users can update suppliers" on suppliers for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'suppliers' and policyname = 'Authenticated users can delete suppliers') then
    create policy "Authenticated users can delete suppliers" on suppliers for delete to authenticated using (true);
  end if;
end $$;
