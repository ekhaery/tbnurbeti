-- Lets a product be bought and/or sold in a unit other than its base
-- unit_of_measurement_id, with a fixed factor back to the base unit (e.g. Kuas 4"
-- base=Pcs, bought in Dus x12; Bata Hebel base=Kubik, sold per Biji). Opt-in per
-- product via the "Unit Alternatif" toggle on the product edit page -- products
-- with no rows here behave exactly as before.
create table product_unit_conversions (
  id bigint primary key generated always as identity,
  product_id bigint not null references products(id) on delete cascade,
  unit_of_measurement_id bigint not null references unit_of_measurements(id),
  factor_to_base numeric not null check (factor_to_base > 0),
  context text not null check (context in ('purchase', 'sale', 'both')),
  price_override numeric,
  created_at timestamptz not null default now(),
  unique (product_id, unit_of_measurement_id, context)
);

alter table product_unit_conversions enable row level security;

create policy "authenticated can read product_unit_conversions"
  on product_unit_conversions for select
  to authenticated
  using (true);

create policy "authenticated can insert product_unit_conversions"
  on product_unit_conversions for insert
  to authenticated
  with check (true);

create policy "authenticated can update product_unit_conversions"
  on product_unit_conversions for update
  to authenticated
  using (true);

create policy "authenticated can delete product_unit_conversions"
  on product_unit_conversions for delete
  to authenticated
  using (true);
