-- Extend create_transaction_with_items to also perform FIFO stock consumption
-- (stock_batch_consumption + stock_batches decrement) inside the same atomic
-- function call. Batches are locked with `for update` as they're read, so
-- concurrent sales can't double-consume the same batch, and any failure
-- anywhere (bad product, bad customer_id, etc.) rolls back the whole sale —
-- including any stock already decremented earlier in the loop.
create or replace function create_transaction_with_items(
  p_code text,
  p_date date,
  p_notes text,
  p_created_by integer,
  p_is_initial_transformation boolean,
  p_items jsonb,
  p_hutang boolean,
  p_customer_id integer,
  p_due_date date,
  p_total numeric
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_transaction_id integer;
  v_item jsonb;
  v_item_id integer;
  v_item_ids integer[] := '{}';
  v_product_id integer;
  v_qty double precision;
  v_price_sold numeric;
  v_discount numeric;
  v_remaining double precision;
  v_total_cogs numeric;
  v_batch record;
  v_consume double precision;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'at least one item is required';
  end if;

  if p_hutang and p_customer_id is null then
    raise exception 'customer_id is required to create a receivable';
  end if;

  insert into transactions (code, date, notes, created_by, is_initial_transformation, is_paid)
  values (p_code, p_date, p_notes, p_created_by, p_is_initial_transformation, not p_hutang)
  returning id into v_transaction_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::integer;
    v_qty := (v_item->>'qty')::double precision;
    v_price_sold := (v_item->>'price_sold')::numeric;
    v_discount := (v_item->>'discount')::numeric;

    insert into transaction_items (transaction_id, product_id, qty, price_sold, cogs, discount)
    values (v_transaction_id, v_product_id, v_qty, v_price_sold, 0, v_discount)
    returning id into v_item_id;
    v_item_ids := array_append(v_item_ids, v_item_id);

    v_remaining := v_qty;
    v_total_cogs := 0;

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
      v_total_cogs := v_total_cogs + v_consume * v_batch.base_price;

      insert into stock_batch_consumption (transaction_item_id, stock_batch_id, qty_consumed)
      values (v_item_id, v_batch.id, v_consume);

      update stock_batches set qty_remaining = qty_remaining - v_consume where id = v_batch.id;

      v_remaining := v_remaining - v_consume;
    end loop;

    update transaction_items set cogs = v_total_cogs where id = v_item_id;
  end loop;

  if p_hutang then
    insert into customer_receivables (customer_id, transaction_id, date, due_date, total, remaining_amount, status)
    values (p_customer_id, v_transaction_id, p_date, p_due_date, p_total, p_total, 'Belum Dibayar');
  end if;

  return jsonb_build_object('transaction_id', v_transaction_id, 'item_ids', to_jsonb(v_item_ids));
end;
$$;
