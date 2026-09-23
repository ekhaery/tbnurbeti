-- Traces each installment bill back to the specific faktur (purchasing_receipts
-- row) that generated it. bills.purchasing_id already has no unique
-- constraint (multiple rows per PO are used for weekly installments), so
-- this is purely additive and doesn't change any existing grouping-by-
-- purchasing_id read query.
alter table bills
  add column if not exists purchasing_receipt_id integer references purchasing_receipts (id);
