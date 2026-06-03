alter table purchasing
  add column if not exists total numeric(15, 2) not null default 0;
