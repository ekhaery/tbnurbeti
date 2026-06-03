alter table purchasing
  add column if not exists period integer not null default 0;
