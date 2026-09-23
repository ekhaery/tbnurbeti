-- Splits receiving into multiple fakturs (receipt_id set only once a line is
-- actually received -- NULL means still pending a faktur) and records a
-- per-line supplier discount applied at receive time. base_price stays the
-- NET (post-discount) cost per base unit that flows into
-- stock_batches/COGS; gross_base_price preserves what was actually billed
-- before discount, purely for audit/display so the discount breakdown can
-- be shown back to staff without lossy reverse-math off a rounded net price.
alter table purchasing_items
  add column if not exists receipt_id integer references purchasing_receipts (id),
  add column if not exists discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists gross_base_price numeric(15, 2);

create index if not exists purchasing_items_receipt_id_idx on purchasing_items (receipt_id);
