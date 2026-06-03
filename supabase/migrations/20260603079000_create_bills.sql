create table bills (
  id serial primary key,
  purchasing_id integer not null references purchasing (id) on delete cascade,
  supplier_id integer not null references suppliers (id),
  due_date date not null,
  month varchar(20) not null,
  installment numeric(15, 2) not null default 0,
  paid_amount numeric(15, 2) not null default 0,
  is_paid boolean not null default false,
  -- future enhancements
  bill_no text,
  payment_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-set is_paid when paid_amount >= installment
create or replace function bills_check_paid()
returns trigger as $$
begin
  if new.paid_amount >= new.installment then
    new.is_paid := true;
  else
    new.is_paid := false;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger bills_auto_paid
  before insert or update on bills
  for each row execute function bills_check_paid();

-- RLS
alter table bills enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'bills' and policyname = 'Authenticated users can read bills') then
    create policy "Authenticated users can read bills" on bills for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'bills' and policyname = 'Authenticated users can insert bills') then
    create policy "Authenticated users can insert bills" on bills for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'bills' and policyname = 'Authenticated users can update bills') then
    create policy "Authenticated users can update bills" on bills for update to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'bills' and policyname = 'Authenticated users can delete bills') then
    create policy "Authenticated users can delete bills" on bills for delete to authenticated using (true);
  end if;
end $$;
