-- Ensure ON CONFLICT (purchasing_item_id) has a unique constraint to target
create unique index if not exists stock_batches_purchasing_item_id_key on stock_batches (purchasing_item_id);

CREATE OR REPLACE FUNCTION receive_delivery_order(
  p_purchasing_id BIGINT,
  p_items JSONB,        -- [{ "purchasing_item_id": ..., "qty": ..., "base_price": ... }, ...]
  p_invoice_no TEXT,
  p_due_date DATE,
  p_warehouse_id BIGINT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_price NUMERIC;
  v_total NUMERIC := 0;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (item->>'qty')::INTEGER;
    v_price := (item->>'base_price')::NUMERIC;

    UPDATE purchasing_items SET qty = v_qty, base_price = v_price
      WHERE id = (item->>'purchasing_item_id')::BIGINT
      RETURNING product_id INTO v_product_id;

    IF v_qty > 0 THEN
      INSERT INTO stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at, is_available)
      VALUES ((item->>'purchasing_item_id')::BIGINT, v_product_id, v_qty, v_price, CURRENT_DATE, true)
      ON CONFLICT (purchasing_item_id) DO UPDATE
        SET qty_remaining = EXCLUDED.qty_remaining, base_price = EXCLUDED.base_price, is_available = true;

      IF v_price > 0 THEN
        UPDATE products SET base_price = v_price, updated_at = NOW() WHERE id = v_product_id;
      END IF;

      IF p_warehouse_id IS NOT NULL THEN
        PERFORM add_to_warehouse_stock(v_product_id, p_warehouse_id, v_qty);
      END IF;
    END IF;

    v_total := v_total + (v_qty * v_price);
  END LOOP;

  UPDATE purchasing
    SET status = 'completed', total = v_total, invoice_no = p_invoice_no, due_date = p_due_date
    WHERE id = p_purchasing_id;
END;
$$;
