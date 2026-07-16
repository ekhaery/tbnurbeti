alter table transactions
  add column total_unpaid double precision;

alter table dev.transactions
  add column total_unpaid double precision;
