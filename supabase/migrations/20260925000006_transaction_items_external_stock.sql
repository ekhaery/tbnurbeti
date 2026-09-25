-- Selling items the store has no stock for ("ambil dari toko lain").
--
-- A sale may now ask for more than stock_batches can cover: FIFO consumes what
-- exists and the uncovered qty is recorded as external_qty. Later, in menu
-- "HPP Toko Lain", receive_external_stock records what was actually taken from the
-- other store as a normal purchase (the store becomes the supplier): the sold part
-- is FIFO-consumed from that new batch (so cogs is correct), any extra goes into
-- stock + a warehouse, and a bill is created when it was taken on credit (bon).

alter table transaction_items
  add column if not exists external_qty double precision not null default 0,
  add column if not exists external_purchasing_id integer references purchasing (id);

-- No backfill: items sold before FIFO consumption tracking have no consumption
-- rows at all, so "qty - consumed" can't tell old sales from real shortages.

-- Same as 20260717000002, plus: qty FIFO can't cover is stored as external_qty.
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

    update transaction_items
    set cogs = v_total_cogs,
        external_qty = greatest(v_remaining, 0)
    where id = v_item_id;
  end loop;

  if p_hutang then
    insert into customer_receivables (customer_id, transaction_id, date, due_date, total, remaining_amount, status)
    values (p_customer_id, v_transaction_id, p_date, p_due_date, p_total, p_total, 'Belum Dibayar');
  end if;

  return jsonb_build_object('transaction_id', v_transaction_id, 'item_ids', to_jsonb(v_item_ids));
end;
$$;

-- Same as 20260803000014, but aware of external_qty (the part not yet received
-- from another store): only p_qty - external_qty is backed by stock. Lowering qty
-- drops the external part first; raising qty beyond available stock adds to
-- external_qty instead of failing.
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
  v_external_qty double precision;
  v_target_stock_qty double precision;
  v_current_consumed double precision;
  v_delta double precision;
  v_remaining double precision;
  v_consume double precision;
  v_batch record;
  v_cons record;
  v_total_cogs numeric;
begin
  select product_id, external_qty
  into v_product_id, v_external_qty
  from transaction_items
  where id = p_transaction_item_id
  for update;

  if v_product_id is null then
    raise exception 'transaction_item % not found', p_transaction_item_id;
  end if;

  v_external_qty := least(coalesce(v_external_qty, 0), greatest(p_qty, 0));
  v_target_stock_qty := greatest(p_qty - v_external_qty, 0);

  select coalesce(sum(qty_consumed), 0) into v_current_consumed
  from stock_batch_consumption
  where transaction_item_id = p_transaction_item_id;

  v_delta := v_target_stock_qty - v_current_consumed;

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

    -- Not enough stock: the rest is taken from another store
    if v_remaining > 0 then
      v_external_qty := v_external_qty + v_remaining;
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
  set qty = p_qty, price_sold = p_price_sold, discount = p_discount,
      cogs = v_total_cogs, external_qty = v_external_qty
  where id = p_transaction_item_id;
end;
$$;

-- Menu "HPP Toko Lain": record what was taken from another store for an item's
-- external_qty. p_total_qty (>= the sold external qty) is bought from p_supplier_id
-- at p_unit_cost per base unit; the sold part is consumed from the new batch, the
-- rest stays as stock in p_warehouse_id. p_due_date not null = taken on credit
-- (bon) -> one bill; null = paid cash -> no bill.
create or replace function receive_external_stock(
  p_transaction_item_id integer,
  p_total_qty integer,
  p_unit_cost numeric,
  p_supplier_id integer,
  p_warehouse_id integer,
  p_due_date date,
  p_created_by integer
)
returns integer -- purchasing id
language plpgsql
security definer
as $$
declare
  v_item record;
  v_code text;
  v_total numeric;
  v_leftover double precision;
  v_purchasing_id integer;
  v_purchasing_item_id integer;
  v_batch_id integer;
  v_cogs numeric;
begin
  select ti.id, ti.product_id, ti.external_qty, t.code as transaction_code
  into v_item
  from transaction_items ti
  join transactions t on t.id = ti.transaction_id
  where ti.id = p_transaction_item_id
  for update of ti;

  if v_item.id is null then
    raise exception 'transaction_item % not found', p_transaction_item_id;
  end if;
  if coalesce(v_item.external_qty, 0) <= 0 then
    raise exception 'item ini tidak punya kekurangan stok yang perlu diterima';
  end if;
  if p_total_qty is null or p_total_qty < v_item.external_qty then
    raise exception 'total diambil (%) kurang dari qty yang terjual (%)', p_total_qty, v_item.external_qty;
  end if;
  if p_unit_cost is null or p_unit_cost <= 0 then
    raise exception 'harga modal harus lebih dari 0';
  end if;
  if p_supplier_id is null then
    raise exception 'toko asal (supplier) wajib diisi';
  end if;

  v_leftover := p_total_qty - v_item.external_qty;
  if v_leftover > 0 and p_warehouse_id is null then
    raise exception 'pilih warehouse untuk sisa barang';
  end if;

  v_code := 'TL-' || v_item.transaction_code || '-' || v_item.id;
  v_total := p_total_qty * p_unit_cost;

  insert into purchasing (code, supplier_id, date, notes, created_by, status, total, due_date, due_tolerance)
  values (
    v_code, p_supplier_id, current_date,
    'Ambil toko lain untuk transaksi ' || v_item.transaction_code,
    p_created_by, 'completed', v_total, p_due_date, p_due_date
  )
  returning id into v_purchasing_id;

  insert into purchasing_items (purchasing_id, product_id, qty, base_price)
  values (v_purchasing_id, v_item.product_id, p_total_qty, p_unit_cost)
  returning id into v_purchasing_item_id;

  -- The whole purchase lands as one batch; the sold part is consumed right away
  insert into stock_batches (purchasing_item_id, product_id, qty_remaining, base_price, received_at, is_available)
  values (v_purchasing_item_id, v_item.product_id, v_leftover, p_unit_cost, current_date, true)
  returning id into v_batch_id;

  insert into stock_batch_consumption (transaction_item_id, stock_batch_id, qty_consumed)
  values (v_item.id, v_batch_id, v_item.external_qty);

  select coalesce(sum(sbc.qty_consumed * sb.base_price), 0) into v_cogs
  from stock_batch_consumption sbc
  join stock_batches sb on sb.id = sbc.stock_batch_id
  where sbc.transaction_item_id = v_item.id;

  update transaction_items
  set external_qty = 0, external_purchasing_id = v_purchasing_id, cogs = v_cogs
  where id = v_item.id;

  if v_leftover > 0 then
    perform add_to_warehouse_stock(v_item.product_id, p_warehouse_id, v_leftover);
  end if;

  if p_due_date is not null then
    insert into bills (purchasing_id, supplier_id, due_date, installment_due_date, month, installment, paid_amount, bill_no)
    values (
      v_purchasing_id, p_supplier_id, p_due_date, p_due_date,
      trim(to_char(p_due_date, 'Month')) || ' ' || to_char(p_due_date, 'YYYY'),
      v_total, 0, 'BILL-' || v_code || '-1/1'
    );
  end if;

  return v_purchasing_id;
end;
$$;
