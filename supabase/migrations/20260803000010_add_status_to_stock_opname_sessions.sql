ALTER TABLE stock_opname_sessions
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'confirmed'));
