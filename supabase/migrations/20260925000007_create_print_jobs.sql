-- Generic print queue for documents that aren't a sales receipt (receipts are
-- still printed straight off INSERTs on transactions). The printer listeners
-- (printer-listener/listener.js on the Orange Pi, and /admin/print-listener)
-- subscribe to INSERTs here via Realtime and print by `type`:
--   'surat_jalan' -> payload { no, date, store, items: [{ name, qty, unit }] }

create table if not exists print_jobs (
  id serial primary key,
  type text not null,
  payload jsonb not null,
  created_by integer references users (id),
  created_at timestamptz not null default now()
);

alter table print_jobs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'print_jobs' and policyname = 'Authenticated users can read print_jobs') then
    create policy "Authenticated users can read print_jobs" on print_jobs for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'print_jobs' and policyname = 'Authenticated users can insert print_jobs') then
    create policy "Authenticated users can insert print_jobs" on print_jobs for insert to authenticated with check (true);
  end if;
  -- listener.js connects with the anon key; it must be able to receive the row
  if not exists (select 1 from pg_policies where tablename = 'print_jobs' and policyname = 'Anon can read print_jobs') then
    create policy "Anon can read print_jobs" on print_jobs for select to anon using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'print_jobs'
  ) then
    alter publication supabase_realtime add table print_jobs;
  end if;
end $$;
