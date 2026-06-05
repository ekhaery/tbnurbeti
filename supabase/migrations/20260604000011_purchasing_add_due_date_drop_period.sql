-- Add due_date to purchasing
alter table purchasing add column if not exists due_date date;

-- Seed due_date from bills
update purchasing p
set due_date = b.due_date
from (
  select purchasing_id, min(due_date) as due_date
  from bills
  group by purchasing_id
) b
where p.id = b.purchasing_id;

-- Remove period column
alter table purchasing drop column if exists period;
