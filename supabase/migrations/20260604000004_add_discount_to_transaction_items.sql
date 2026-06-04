alter table transaction_items add column if not exists discount numeric(15,2) not null default 0;
