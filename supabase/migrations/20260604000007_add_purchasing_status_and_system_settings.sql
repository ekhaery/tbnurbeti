-- Add status to purchasing
alter table purchasing add column if not exists status text not null default 'init';

-- System settings table
create table if not exists system_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Default: transformation_phase = true
insert into system_settings (key, value)
values ('transformation_phase', 'true')
on conflict (key) do nothing;

-- RLS
alter table system_settings enable row level security;

create policy "Authenticated users can read system_settings"
  on system_settings for select to authenticated using (true);

create policy "Authenticated users can update system_settings"
  on system_settings for update to authenticated using (true);
