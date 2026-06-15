create or replace function get_products_no_stock()
returns table(id integer, name text, base_price numeric, price numeric)
language sql
security definer
as $$
  select p.id, p.name, p.base_price, p.price
  from products p
  where not exists (
    select 1 from stock_batches sb where sb.product_id = p.id
  )
  and p.base_price = 0
  and p.name not ilike '%Vinilex%'
  and p.name not ilike '%Pastel%'
  and p.name not ilike '%Tint%'
  and p.name not ilike '%Deep%'
  and p.name not ilike '%Accent%'
  and p.name not ilike '%Elastex%'
  and p.name not ilike '%Spot Less%'
  and p.name not ilike '%Satin Glo%'
  and p.name not ilike '%Catylac Interior Base%'
  order by p.name
  limit 10000;
$$;
