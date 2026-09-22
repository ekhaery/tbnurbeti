-- Removes the 7 warehouses already marked is_active = false (Gudang A, Gudang B, Gudang C,
-- Gudang D, Gudang E, Gudang Kamar, Rak Toko 1) that are no longer used.
--
-- Product 523 (Pipa 1¼ Aw Rucika) had 14 real units recorded against Gudang C (a data-entry
-- mistake -- it should have been logged under Gudang Tengah / G-02, which it's already also
-- linked to with 0 stock there). That's merged into the Gudang Tengah row first so the unit
-- count survives the warehouse deletion below.
--
-- stock_opname_item_warehouses.warehouse_id has no ON DELETE CASCADE, so the 5 historical
-- opname rows still pointing at these warehouses are deleted first (their parent
-- stock_opname_items / stock_opname_sessions rows are untouched -- only the per-warehouse
-- count line is removed). product_warehouse.warehouse_id does cascade, so the remaining
-- (already-zero) per-product rows tied to these warehouses are removed automatically when the
-- warehouses themselves are deleted.
do $$
declare
  v_inactive_warehouse_ids integer[] := array[1, 2, 3, 4, 5, 6, 7];
begin
  update product_warehouse
  set stock = stock + (
    select coalesce(sum(pw2.stock), 0)
    from product_warehouse pw2
    where pw2.product_id = 523 and pw2.warehouse_id = 5
  )
  where product_id = 523 and warehouse_id = 9;

  delete from stock_opname_item_warehouses
  where warehouse_id = any(v_inactive_warehouse_ids);

  delete from warehouses
  where id = any(v_inactive_warehouse_ids) and is_active = false;
end;
$$;
