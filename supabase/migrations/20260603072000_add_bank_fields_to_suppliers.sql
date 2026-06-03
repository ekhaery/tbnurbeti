alter table suppliers
  add column if not exists no_rek text,
  add column if not exists bank_acc text;
