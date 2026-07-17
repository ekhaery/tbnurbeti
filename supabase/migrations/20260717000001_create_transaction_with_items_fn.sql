-- Fully atomic transaction creation: transactions + all transaction_items +
-- customer_receivables (when hutang) are inserted inside one function call,
-- which PostgREST/supabase.rpc() executes as a single transaction. Any failure
-- (a bad item, a missing customer_id for a hutang sale, etc.) raises an
-- exception and rolls back everything inserted so far — no partial rows.
drop function if exists create_transaction_with_receivable(text, date, text, integer, boolean, integer, date, numeric);

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
    insert into transaction_items (transaction_id, product_id, qty, price_sold, cogs, discount)
    values (
      v_transaction_id,
      (v_item->>'product_id')::integer,
      (v_item->>'qty')::double precision,
      (v_item->>'price_sold')::numeric,
      (v_item->>'cogs')::numeric,
      (v_item->>'discount')::numeric
    )
    returning id into v_item_id;
    v_item_ids := array_append(v_item_ids, v_item_id);
  end loop;

  if p_hutang then
    insert into customer_receivables (customer_id, transaction_id, date, due_date, total, remaining_amount, status)
    values (p_customer_id, v_transaction_id, p_date, p_due_date, p_total, p_total, 'Belum Dibayar');
  end if;

  return jsonb_build_object('transaction_id', v_transaction_id, 'item_ids', to_jsonb(v_item_ids));
end;
$$;
