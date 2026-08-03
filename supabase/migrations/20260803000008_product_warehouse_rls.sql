ALTER TABLE product_warehouse ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can select product_warehouse"
  ON product_warehouse FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert product_warehouse"
  ON product_warehouse FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can delete product_warehouse"
  ON product_warehouse FOR DELETE TO authenticated USING (true);
