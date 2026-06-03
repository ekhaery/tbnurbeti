-- Add new json column
alter table suppliers
  add column if not exists bank_detail jsonb;

-- Migrate existing data into json
update suppliers
set bank_detail = jsonb_strip_nulls(jsonb_build_object(
  'bank',     bank_acc,
  'no_rek',   no_rek,
  'rek_name', rek_name
))
where bank_acc is not null or no_rek is not null or rek_name is not null;

-- Drop old columns
alter table suppliers
  drop column if exists bank_acc,
  drop column if exists no_rek,
  drop column if exists rek_name;
