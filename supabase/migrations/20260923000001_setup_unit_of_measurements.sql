-- Finishes wiring up the half-built "Unit" feature: the product edit page already
-- reads/writes products.unit_of_measurement_id, but no migration ever created that
-- column (schema drift risk -- ADD COLUMN IF NOT EXISTS makes this safe either way).
-- unit_of_measurements also only had a SELECT policy, so there was no way to manage
-- units from the UI, and the table had no seed data at all.
alter table products
  add column if not exists unit_of_measurement_id bigint references unit_of_measurements(id);

create policy "authenticated can insert unit_of_measurements"
  on unit_of_measurements for insert
  to authenticated
  with check (true);

create policy "authenticated can update unit_of_measurements"
  on unit_of_measurements for update
  to authenticated
  using (true);

create policy "authenticated can delete unit_of_measurements"
  on unit_of_measurements for delete
  to authenticated
  using (true);

insert into unit_of_measurements (name, abbreviation) values
  ('Pcs', 'Pcs'),
  ('Kilogram', 'Kg'),
  ('Ons', 'Ons'),
  ('Gram', 'Gr'),
  ('Meter', 'M'),
  ('Liter', 'Ltr'),
  ('Galon', 'Gal'),
  ('Batang', 'Btg'),
  ('Roll', 'Roll'),
  ('Dus', 'Dus'),
  ('Sak', 'Sak'),
  ('Lembar', 'Lbr'),
  ('Kaleng', 'Klg'),
  ('Set', 'Set')
on conflict (name) do nothing;
