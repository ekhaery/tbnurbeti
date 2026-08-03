CREATE TABLE stock_opname_item_warehouses (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES stock_opname_items(id) ON DELETE CASCADE,
    warehouse_id BIGINT NOT NULL REFERENCES warehouses(id),
    counted_stock DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_stock_opname_item_warehouse UNIQUE (item_id, warehouse_id)
);

CREATE INDEX idx_stock_opname_item_warehouses_item
    ON stock_opname_item_warehouses(item_id);

ALTER TABLE stock_opname_item_warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can select stock_opname_item_warehouses"
    ON stock_opname_item_warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert stock_opname_item_warehouses"
    ON stock_opname_item_warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update stock_opname_item_warehouses"
    ON stock_opname_item_warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
