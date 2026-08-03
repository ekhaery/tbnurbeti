CREATE TABLE stock_transfers (
  id BIGSERIAL PRIMARY KEY,
  from_warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
  to_warehouse_id   BIGINT NOT NULL REFERENCES warehouses(id),
  product_id        BIGINT NOT NULL REFERENCES products(id),
  qty               DOUBLE PRECISION NOT NULL CHECK (qty > 0),
  transferred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        BIGINT REFERENCES users(id),
  notes             TEXT
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select stock_transfers"
  ON stock_transfers FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth insert stock_transfers"
  ON stock_transfers FOR INSERT TO authenticated WITH CHECK (true);
