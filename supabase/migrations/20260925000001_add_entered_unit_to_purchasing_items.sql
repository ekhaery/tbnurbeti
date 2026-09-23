-- Preserves the unit and quantity staff actually typed when creating a
-- purchasing/delivery order (e.g. "25 Dus"), separate from `qty` which is
-- always stored converted to the product's base unit (e.g. 300 Pcs). Needed
-- so ReceiveDeliveryOrderModal can show/re-enter amounts in the same unit as
-- the supplier's invoice instead of only the already-converted base-unit
-- number.
alter table purchasing_items
  add column if not exists unit_of_measurement_id bigint references unit_of_measurements(id),
  add column if not exists entered_qty numeric;
