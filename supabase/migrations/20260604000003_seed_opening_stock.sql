-- Run once after all products have been inputted.
-- Creates a dummy "Opening Balance" purchasing record and seeds
-- stock_batches from existing products.stock + products.base_price.
--
-- Rules:
-- * base_price = 0      → skip entirely
-- * stock > 0           → use actual stock value
-- * stock IS NULL       → use 200 as placeholder
-- * stock = 0           → skip (no batch needed)

do $$ begin
  if exists (select 1 from purchasing where code = 'OPENING-BALANCE') then
    raise notice 'Opening balance already seeded. Skipping.';
    return;
  end if;

  -- 1. Create dummy supplier if not exists
  if not exists (select 1 from suppliers where name = 'Opening Stock') then
    insert into suppliers (name) values ('Opening Stock');
  end if;

  -- 2. Create dummy purchasing (status = completed, is_available = true)
  insert into purchasing (code, supplier_id, date, notes, total, created_by, status)
  select
    'OPENING-BALANCE',
    s.id,
    current_date,
    'Saldo awal stok',
    coalesce(sum(coalesce(p.stock, 200) * p.base_price), 0),
    null,
    'completed'
  from suppliers s
  cross join products p
  where s.name = 'Opening Stock'
    and (p.stock > 0 or p.stock is null)
    and p.base_price > 0
  group by s.id;

  -- 3. Insert purchasing_items
  insert into purchasing_items (purchasing_id, product_id, qty, base_price)
  select
    pur.id,
    p.id,
    coalesce(p.stock, 200),
    p.base_price
  from products p
  join purchasing pur on pur.code = 'OPENING-BALANCE'
  where (p.stock > 0 or p.stock is null)
    and p.base_price > 0;

  -- 4. Insert stock_batches (is_available = true so transactions can proceed immediately)
  insert into stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at, is_available)
  select
    pi.id,
    pi.product_id,
    pi.qty,
    pi.base_price,
    current_date,
    true
  from purchasing_items pi
  join purchasing pur on pur.id = pi.purchasing_id
  where pur.code = 'OPENING-BALANCE';

end $$;
