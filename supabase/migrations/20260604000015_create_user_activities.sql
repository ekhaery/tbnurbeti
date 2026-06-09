create table user_activities (
  id bigserial primary key,
  user_id integer references users (id) on delete set null,
  activity text not null,
  created_at timestamptz not null default now()
);

alter table user_activities enable row level security;
create policy "Authenticated full access user_activities"
  on user_activities for all to authenticated using (true) with check (true);
