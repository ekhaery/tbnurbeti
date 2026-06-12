alter table debt_loan add column if not exists supplier_id integer references suppliers (id) on delete set null;
