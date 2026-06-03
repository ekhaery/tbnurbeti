alter table categories
  add column is_price_required boolean not null default true;

-- Cat Tembok (id: 1) → FALSE
update categories set is_price_required = false where id = 1;