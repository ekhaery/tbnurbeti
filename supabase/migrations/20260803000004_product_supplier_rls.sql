ALTER TABLE product_supplier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read product_supplier"
  ON product_supplier FOR SELECT
  TO authenticated
  USING (true);
