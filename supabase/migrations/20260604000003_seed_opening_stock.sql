-- Run once after all products have been inputted.
-- Creates a dummy "Opening Balance" purchasing record and seeds
-- stock_batches from existing products.stock + products.base_price.
--
-- Rules:
-- * base_price = 0        → skip entirely
-- * stock > 0             → use actual stock value
-- * stock IS NULL or = 0  → use 200 as placeholder

do $$ begin
  -- 1. Create dummy supplier if not exists
  if not exists (select 1 from suppliers where name = 'Opening Stock') then
    insert into suppliers (name) values ('Opening Stock');
  end if;

  -- 2. Create OPENING-BALANCE purchasing if not exists
  if not exists (select 1 from purchasing where code = 'OPENING-BALANCE') then
    insert into purchasing (code, supplier_id, date, notes, total, created_by, status)
    select 'OPENING-BALANCE', s.id, current_date, 'Saldo awal stok', 0, null, 'completed'
    from suppliers s where s.name = 'Opening Stock';
  end if;

  -- 3. Insert purchasing_items for products that:
  --    - have base_price > 0
  --    - do NOT already have a stock_batch (safe to re-run)
  insert into purchasing_items (purchasing_id, product_id, qty, base_price)
  select
    pur.id,
    p.id,
    case when coalesce(p.stock, 0) > 0 then p.stock else 200 end,
    p.base_price
  from products p
  join purchasing pur on pur.code = 'OPENING-BALANCE'
  where p.base_price > 0
    and not exists (
      select 1 from stock_batches sb
      join purchasing_items pi on pi.id = sb.purchasing_item_id
      where pi.product_id = p.id
    );

  -- 4. Insert stock_batches for newly added purchasing_items
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
  where pur.code = 'OPENING-BALANCE'
    and not exists (
      select 1 from stock_batches sb where sb.purchasing_item_id = pi.id
    );

end $$;
