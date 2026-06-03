alter table products
  add column if not exists is_discontinued boolean not null default false;
