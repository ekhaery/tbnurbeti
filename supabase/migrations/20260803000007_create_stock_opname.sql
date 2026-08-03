CREATE TABLE stock_opname_sessions (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id),
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_opname_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can select stock_opname_sessions"
    ON stock_opname_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert stock_opname_sessions"
    ON stock_opname_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE stock_opname_items (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE stock_opname_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can select stock_opname_items"
    ON stock_opname_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert stock_opname_items"
    ON stock_opname_items FOR INSERT TO authenticated WITH CHECK (true);
