CREATE OR REPLACE FUNCTION confirm_stock_opname(p_session_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO product_warehouse (product_id, warehouse_id, stock)
  SELECT
    soi.product_id,
    soiw.warehouse_id,
    soiw.counted_stock
  FROM stock_opname_item_warehouses soiw
  JOIN stock_opname_items soi ON soi.id = soiw.item_id
  WHERE soi.session_id = p_session_id
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET stock = EXCLUDED.stock, updated_at = NOW();

  UPDATE stock_opname_sessions SET status = 'confirmed' WHERE id = p_session_id;
END;
$$;
