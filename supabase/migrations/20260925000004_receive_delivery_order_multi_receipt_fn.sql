-- Rewrites receive_delivery_order to accept only a SUBSET of a PO's
-- purchasing_items per call (the rest stay pending for a later faktur),
-- creates one purchasing_receipts row per call, and applies a per-line
-- percent discount server-side so base_price/stock_batches.base_price/
-- products.base_price always agree on the net (post-discount) cost.
-- purchasing.status/total are always recomputed from the full set of
-- purchasing_items for the PO, so they stay correct across any number of
-- receiving passes.
--
-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (void -> bigint here), so the old 5-arg version is dropped explicitly
-- first.
DROP FUNCTION IF EXISTS receive_delivery_order(BIGINT, JSONB, TEXT, DATE, BIGINT);

CREATE OR REPLACE FUNCTION receive_delivery_order(
  p_purchasing_id BIGINT,
  p_items JSONB,        -- [{ "purchasing_item_id", "qty", "gross_base_price", "discount_percent" }, ...]
  p_invoice_no TEXT,
  p_due_date DATE,
  p_warehouse_id BIGINT,
  p_created_by BIGINT DEFAULT NULL
)
RETURNS BIGINT               -- id of the new purchasing_receipts row
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
  v_product_id BIGINT;
  v_qty INTEGER;
  v_gross NUMERIC;
  v_discount NUMERIC;
  v_net NUMERIC;
  v_receipt_id BIGINT;
  v_receipt_total NUMERIC := 0;
  v_po_total NUMERIC;
  v_pending_count INTEGER;
BEGIN
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_items)) = 0 THEN
    RAISE EXCEPTION 'p_items tidak boleh kosong';
  END IF;

  INSERT INTO purchasing_receipts (purchasing_id, invoice_no, due_date, warehouse_id, created_by)
  VALUES (p_purchasing_id, NULLIF(p_invoice_no, ''), p_due_date, p_warehouse_id, p_created_by)
  RETURNING id INTO v_receipt_id;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (item->>'qty')::INTEGER;
    v_gross := (item->>'gross_base_price')::NUMERIC;
    v_discount := COALESCE((item->>'discount_percent')::NUMERIC, 0);

    IF v_discount < 0 OR v_discount > 100 THEN
      RAISE EXCEPTION 'discount_percent harus di antara 0 dan 100';
    END IF;

    v_net := ROUND(v_gross * (1 - v_discount / 100), 2);

    UPDATE purchasing_items
      SET qty = v_qty,
          base_price = v_net,
          gross_base_price = v_gross,
          discount_percent = v_discount,
          receipt_id = v_receipt_id
      WHERE id = (item->>'purchasing_item_id')::BIGINT
        AND purchasing_id = p_purchasing_id
        AND receipt_id IS NULL          -- guards against receiving the same line twice
      RETURNING product_id INTO v_product_id;

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'purchasing_item % sudah diterima sebelumnya atau bukan bagian dari PO ini', (item->>'purchasing_item_id')::BIGINT;
    END IF;

    IF v_qty > 0 THEN
      INSERT INTO stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at, is_available)
      VALUES ((item->>'purchasing_item_id')::BIGINT, v_product_id, v_qty, v_net, CURRENT_DATE, true)
      ON CONFLICT (purchasing_item_id) DO UPDATE
        SET qty_remaining = EXCLUDED.qty_remaining, base_price = EXCLUDED.base_price, is_available = true;

      IF v_net > 0 THEN
        UPDATE products SET base_price = v_net, updated_at = NOW() WHERE id = v_product_id;
      END IF;

      IF p_warehouse_id IS NOT NULL THEN
        PERFORM add_to_warehouse_stock(v_product_id, p_warehouse_id, v_qty);
      END IF;
    END IF;

    v_receipt_total := v_receipt_total + (v_qty * v_net);
  END LOOP;

  UPDATE purchasing_receipts SET total = v_receipt_total WHERE id = v_receipt_id;

  SELECT COALESCE(SUM(qty * base_price), 0) INTO v_po_total
    FROM purchasing_items WHERE purchasing_id = p_purchasing_id;

  SELECT COUNT(*) INTO v_pending_count
    FROM purchasing_items WHERE purchasing_id = p_purchasing_id AND receipt_id IS NULL;

  UPDATE purchasing
    SET total = v_po_total,
        status = CASE WHEN v_pending_count > 0 THEN 'partial' ELSE 'completed' END,
        invoice_no = COALESCE(NULLIF(p_invoice_no, ''), invoice_no),
        due_date = COALESCE(p_due_date, due_date)
    WHERE id = p_purchasing_id;

  RETURN v_receipt_id;
END;
$$;
