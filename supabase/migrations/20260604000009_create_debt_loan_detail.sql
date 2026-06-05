create table debt_loan_detail (
  id serial primary key,
  debt_loan_id integer not null references debt_loan (id) on delete cascade,
  code text,
  date date not null default current_date,
  due_date date,
  installment_amount numeric(15,2) not null default 0,
  installment_due_date date,
  is_paid boolean not null default false,
  payment_date date,
  created_at timestamptz not null default now()
);

alter table debt_loan_detail enable row level security;

create policy "Authenticated full access debt_loan_detail"
  on debt_loan_detail for all to authenticated using (true) with check (true);
