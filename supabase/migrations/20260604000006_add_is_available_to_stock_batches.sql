alter table stock_batches add column if not exists is_available boolean not null default false;
