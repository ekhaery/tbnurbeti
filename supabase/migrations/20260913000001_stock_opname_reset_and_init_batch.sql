-- When a stock opname session is confirmed, the counted stock becomes the new
-- source of truth for the product: zero out every existing stock_batch for the
-- product (opening balance placeholder and/or real purchase batches), then
-- create a fresh stock_batch per warehouse under a dedicated
-- 'STOCK-OPNAME-<session_id>' purchasing record reflecting the counted qty.
CREATE OR REPLACE FUNCTION confirm_stock_opname(p_session_id BIGINT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supplier_id INTEGER;
  v_purchasing_id INTEGER;
  v_created_by INTEGER;
BEGIN
  IF (SELECT status FROM stock_opname_sessions WHERE id = p_session_id) = 'confirmed' THEN
    RETURN;
  END IF;

  SELECT created_by INTO v_created_by FROM stock_opname_sessions WHERE id = p_session_id;

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

  UPDATE stock_batches sb
  SET qty_remaining = 0, is_available = false
  WHERE sb.product_id IN (
    SELECT DISTINCT product_id FROM stock_opname_items WHERE session_id = p_session_id
  );

  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE name = 'Stock Opname') THEN
    INSERT INTO suppliers (name) VALUES ('Stock Opname');
  END IF;
  SELECT id INTO v_supplier_id FROM suppliers WHERE name = 'Stock Opname';

  INSERT INTO purchasing (code, supplier_id, date, notes, created_by, status)
  VALUES (
    'STOCK-OPNAME-' || p_session_id,
    v_supplier_id,
    CURRENT_DATE,
    'Hasil stock opname sesi #' || p_session_id,
    v_created_by,
    'completed'
  )
  RETURNING id INTO v_purchasing_id;

  WITH inserted_items AS (
    INSERT INTO purchasing_items (purchasing_id, product_id, qty, base_price)
    SELECT
      v_purchasing_id,
      soi.product_id,
      ROUND(soiw.counted_stock)::integer,
      p.base_price
    FROM stock_opname_item_warehouses soiw
    JOIN stock_opname_items soi ON soi.id = soiw.item_id
    JOIN products p ON p.id = soi.product_id
    WHERE soi.session_id = p_session_id
      AND ROUND(soiw.counted_stock)::integer > 0
    RETURNING id, product_id, qty, base_price
  )
  INSERT INTO stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at, is_available)
  SELECT id, product_id, qty, base_price, CURRENT_DATE, true
  FROM inserted_items;

  UPDATE stock_opname_sessions SET status = 'confirmed' WHERE id = p_session_id;
END;
$$;
