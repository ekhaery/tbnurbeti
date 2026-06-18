create or replace function trigger_opening_stock()
returns jsonb
language plpgsql
security definer
as $$
declare
  added_names text[];
begin
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

  -- Capture names of products that will be added
  select array_agg(p.name order by p.name) into added_names
  from products p
  join purchasing pur on pur.code = 'OPENING-BALANCE'
  where p.base_price > 1
    and p.price > 1
    and not exists (
      select 1 from stock_batches sb
      join purchasing_items pi on pi.id = sb.purchasing_item_id
      where pi.product_id = p.id
    );

  -- 3. Insert purchasing_items (qty = 200 placeholder)
  insert into purchasing_items (purchasing_id, product_id, qty, base_price)
  select
    pur.id,
    p.id,
    200,
    p.base_price
  from products p
  join purchasing pur on pur.code = 'OPENING-BALANCE'
  where p.base_price > 1
    and p.price > 1
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

  return jsonb_build_object(
    'count', coalesce(array_length(added_names, 1), 0),
    'names', coalesce(to_jsonb(added_names), '[]'::jsonb)
  );
end;
$$;
