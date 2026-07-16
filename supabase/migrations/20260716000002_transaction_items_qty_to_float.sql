alter table transaction_items
  drop column profit;

alter table transaction_items
  alter column qty type double precision;

alter table transaction_items
  add column profit numeric(15, 2) generated always as (price_sold - cogs) stored;

alter table dev.transaction_items
  drop column profit;

alter table dev.transaction_items
  alter column qty type double precision;

alter table dev.transaction_items
  add column profit numeric(15, 2) generated always as (price_sold * qty - cogs) stored;
