-- Backfill: "barang ready" purchases were created with status='completed' and their
-- stock_batches row inserted as is_available=false, even though product_warehouse.stock
-- was incremented immediately. This left list-level stock permanently understated.
-- receive_delivery_order always inserts is_available=true, so any is_available=false
-- batch belonging to an already-'completed' purchasing record can only be one of these
-- stuck rows — safe to flip.
update stock_batches sb
set is_available = true
from purchasing_items pi
join purchasing p on p.id = pi.purchasing_id
where sb.purchasing_item_id = pi.id
  and p.status = 'completed'
  and sb.is_available = false;
