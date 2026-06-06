create table employees (
  id serial primary key,
  name text not null,
  phone_number_1 text,
  phone_number_2 text,
  alamat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table employees enable row level security;
create policy "Authenticated full access employees"
  on employees for all to authenticated using (true) with check (true);

create table employee_salary (
  id serial primary key,
  employee_id integer not null references employees (id) on delete cascade,
  period text not null,
  amount numeric(15,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table employee_salary enable row level security;
create policy "Authenticated full access employee_salary"
  on employee_salary for all to authenticated using (true) with check (true);
