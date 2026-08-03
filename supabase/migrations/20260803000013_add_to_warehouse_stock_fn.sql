CREATE OR REPLACE FUNCTION add_to_warehouse_stock(
  p_product_id  BIGINT,
  p_warehouse_id BIGINT,
  p_qty         DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO product_warehouse (product_id, warehouse_id, stock)
  VALUES (p_product_id, p_warehouse_id, p_qty)
  ON CONFLICT (product_id, warehouse_id)
  DO UPDATE SET stock = product_warehouse.stock + p_qty, updated_at = NOW();
END;
$$;
