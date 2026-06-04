-- price_sold now stores total after discount (price * qty - discount)
-- so profit = price_sold - cogs
alter table transaction_items
  drop column profit;

alter table transaction_items
  add column profit numeric(15,2) generated always as (price_sold - cogs) stored;
