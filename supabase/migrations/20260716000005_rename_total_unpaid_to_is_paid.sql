-- Rename transactions.total_unpaid (amount) to is_paid (boolean flag).
-- Existing rows: no unpaid amount recorded (null/0) -> paid; any recorded amount -> not paid.
alter table transactions rename column total_unpaid to is_paid;
alter table transactions
  alter column is_paid type boolean using (is_paid is null or is_paid = 0),
  alter column is_paid set default true,
  alter column is_paid set not null;

alter table dev.transactions rename column total_unpaid to is_paid;
alter table dev.transactions
  alter column is_paid type boolean using (is_paid is null or is_paid = 0),
  alter column is_paid set default true,
  alter column is_paid set not null;

-- Update the atomic Hutang RPC to write is_paid instead of total_unpaid.
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

  insert into transactions (code, date, notes, created_by, is_initial_transformation, is_paid)
  values (p_code, p_date, p_notes, p_created_by, p_is_initial_transformation, false)
  returning id into v_transaction_id;

  insert into customer_receivables (customer_id, transaction_id, date, due_date, total, remaining_amount, status)
  values (p_customer_id, v_transaction_id, p_date, p_due_date, p_total, p_total, 'Belum Dibayar');

  return v_transaction_id;
end;
$$;
