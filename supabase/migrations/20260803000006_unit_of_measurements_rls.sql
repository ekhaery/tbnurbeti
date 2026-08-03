ALTER TABLE unit_of_measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read unit_of_measurements"
  ON unit_of_measurements FOR SELECT TO authenticated USING (true);
