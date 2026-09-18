create or replace function get_product_sales_report(p_date_from date, p_date_to date)
returns table (
  product_id integer,
  product_name text,
  category_id integer,
  category_name text,
  total_qty numeric,
  total_revenue numeric
)
language sql
security definer
as $$
  select
    p.id,
    p.name,
    p.category_id,
    c.name,
    sum(ti.qty) as total_qty,
    sum(ti.price_sold) as total_revenue
  from transaction_items ti
  join transactions t on t.id = ti.transaction_id
  join products p on p.id = ti.product_id
  left join categories c on c.id = p.category_id
  where t.date between p_date_from and p_date_to
    and coalesce(t.is_initial_transformation, false) = false
  group by p.id, p.name, p.category_id, c.name
  order by total_revenue desc;
$$;
