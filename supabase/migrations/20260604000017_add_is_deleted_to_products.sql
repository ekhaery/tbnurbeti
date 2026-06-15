alter table products
  add column if not exists is_deleted boolean not null default false;
