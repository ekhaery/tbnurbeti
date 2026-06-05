create table debt_loan (
  id serial primary key,
  bank_account text not null,
  debt_type text not null,
  date date not null default current_date,
  debt_amount numeric(15,2) not null default 0,
  installment_type text not null,
  installment_amount numeric(15,2) not null default 0,
  installment_due_date date,
  due_date date,
  period jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table debt_loan enable row level security;

create policy "Authenticated full access debt_loan"
  on debt_loan for all to authenticated using (true) with check (true);
