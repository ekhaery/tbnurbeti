alter table stock_batches
  alter column qty_remaining type double precision;

alter table stock_batch_consumption
  alter column qty_consumed type double precision;

alter table dev.stock_batches
  alter column qty_remaining type double precision;

alter table dev.stock_batch_consumption
  alter column qty_consumed type double precision;
