-- Keeps stock_batches/stock_batch_consumption in sync when an existing
-- transaction_item's qty is edited (transaksi/riwayat), instead of only
-- writing the qty column like before. Compares the item's already-consumed
-- total against the new target qty:
--   * qty increased  -> FIFO-consume the extra amount from available batches
--     (same order/locking as create_transaction_with_items).
--   * qty decreased  -> release the difference back onto stock_batches,
--     unwinding the item's own consumption rows most-recent-first.
-- A brand-new item (no consumption rows yet) is just the pure "increase"
-- branch, so this also covers products added during an edit.
-- cogs is recomputed from the resulting consumption rows so it never drifts.
create or replace function sync_transaction_item_stock(
  p_transaction_item_id integer,
  p_qty double precision,
  p_price_sold numeric,
  p_discount numeric
)
returns void
language plpgsql
security definer
as $$
declare
  v_product_id integer;
  v_current_consumed double precision;
  v_delta double precision;
  v_remaining double precision;
  v_consume double precision;
  v_batch record;
  v_cons record;
  v_total_cogs numeric;
begin
  select product_id into v_product_id
  from transaction_items
  where id = p_transaction_item_id
  for update;

  if v_product_id is null then
    raise exception 'transaction_item % not found', p_transaction_item_id;
  end if;

  select coalesce(sum(qty_consumed), 0) into v_current_consumed
  from stock_batch_consumption
  where transaction_item_id = p_transaction_item_id;

  v_delta := p_qty - v_current_consumed;

  if v_delta > 0 then
    v_remaining := v_delta;

    for v_batch in
      select id, qty_remaining, base_price
      from stock_batches
      where product_id = v_product_id
        and is_available = true
        and qty_remaining > 0
      order by received_at asc, id asc
      for update
    loop
      exit when v_remaining <= 0;
      v_consume := least(v_remaining, v_batch.qty_remaining);

      insert into stock_batch_consumption (transaction_item_id, stock_batch_id, qty_consumed)
      values (p_transaction_item_id, v_batch.id, v_consume);

      update stock_batches set qty_remaining = qty_remaining - v_consume where id = v_batch.id;

      v_remaining := v_remaining - v_consume;
    end loop;

    if v_remaining > 0 then
      raise exception 'stok tidak cukup untuk menaikkan qty (kekurangan %)', v_remaining;
    end if;

  elsif v_delta < 0 then
    v_remaining := -v_delta;

    for v_cons in
      select id, stock_batch_id, qty_consumed
      from stock_batch_consumption
      where transaction_item_id = p_transaction_item_id
      order by id desc
      for update
    loop
      exit when v_remaining <= 0;
      v_consume := least(v_remaining, v_cons.qty_consumed);

      update stock_batches set qty_remaining = qty_remaining + v_consume where id = v_cons.stock_batch_id;

      if v_consume >= v_cons.qty_consumed then
        delete from stock_batch_consumption where id = v_cons.id;
      else
        update stock_batch_consumption set qty_consumed = qty_consumed - v_consume where id = v_cons.id;
      end if;

      v_remaining := v_remaining - v_consume;
    end loop;
  end if;

  select coalesce(sum(sbc.qty_consumed * sb.base_price), 0) into v_total_cogs
  from stock_batch_consumption sbc
  join stock_batches sb on sb.id = sbc.stock_batch_id
  where sbc.transaction_item_id = p_transaction_item_id;

  update transaction_items
  set qty = p_qty, price_sold = p_price_sold, discount = p_discount, cogs = v_total_cogs
  where id = p_transaction_item_id;
end;
$$;
