-- Run once after all products have been inputted.
-- Creates a dummy "Opening Balance" purchasing record and seeds
-- stock_batches from existing products.stock + products.base_price.

do $$ begin
  if exists (select 1 from purchasing where code = 'OPENING-BALANCE') then
    raise notice 'Opening balance already seeded. Skipping.';
    return;
  end if;

  -- 1. Create dummy supplier
  insert into suppliers (name)
  values ('Opening Stock')
  on conflict (name) do nothing;

  -- 2. Create dummy purchasing
  insert into purchasing (code, supplier_id, date, notes, period, total, created_by)
  select
    'OPENING-BALANCE',
    s.id,
    current_date,
    'Saldo awal stok',
    0,
    coalesce(sum(p.stock * p.base_price), 0),
    null
  from suppliers s
  cross join products p
  where s.name = 'Opening Stock'
    and p.stock > 0
  group by s.id;

  -- 3. Insert purchasing_items
  insert into purchasing_items (purchasing_id, product_id, qty, base_price)
  select
    pur.id,
    p.id,
    p.stock,
    p.base_price
  from products p
  join purchasing pur on pur.code = 'OPENING-BALANCE'
  where p.stock > 0;

  -- 4. Insert stock_batches
  insert into stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at)
  select
    pi.id,
    pi.product_id,
    pi.qty,
    pi.base_price,
    current_date
  from purchasing_items pi
  join purchasing pur on pur.id = pi.purchasing_id
  where pur.code = 'OPENING-BALANCE';

end $$;
