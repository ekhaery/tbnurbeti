-- Atomically create a transaction header together with its customer_receivables
-- record when the sale is on credit ("Hutang"). Both inserts run inside this
-- single function invocation, which PostgREST executes as one transaction:
-- if the receivable insert fails, the transaction insert is rolled back too.
create or replace function create_transaction_with_receivable(
  p_code text,
  p_date date,
  p_notes text,
  p_created_by integer,
  p_is_initial_transformation boolean,
  p_customer_id integer,
  p_due_date date,
  p_total numeric
)
returns integer
language plpgsql
security definer
as $$
declare
  v_transaction_id integer;
begin
  if p_customer_id is null then
    raise exception 'customer_id is required to create a receivable';
  end if;

  insert into transactions (code, date, notes, created_by, is_initial_transformation, total_unpaid)
  values (p_code, p_date, p_notes, p_created_by, p_is_initial_transformation, p_total)
  returning id into v_transaction_id;

  insert into customer_receivables (customer_id, transaction_id, date, due_date, total, remaining_amount, status)
  values (p_customer_id, v_transaction_id, p_date, p_due_date, p_total, p_total, 'Belum Dibayar');

  return v_transaction_id;
end;
$$;
