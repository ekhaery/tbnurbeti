-- Hapus permanen produk yang sudah dihapus (is_deleted = true) tetapi namanya
-- sama dengan produk aktif. Jalankan manual di Supabase SQL Editor.

-- Step 1: PREVIEW — produk terhapus yang namanya sama dengan produk aktif
select d.id, d.name, d.code, d.updated_at
from products d
where d.is_deleted = true
  and exists (select 1 from products a
              where a.is_deleted = false and lower(trim(a.name)) = lower(trim(d.name)))
order by lower(d.name), d.id;

-- Step 2: DELETE — satu per satu; produk yang masih dipakai riwayat
-- (stock_batches, purchasing_items, transaction_items, stock_opname, stock_transfers, ...)
-- dilewati. product_supplier, product_warehouse, product_unit_conversions ikut terhapus (cascade).
do $$
declare r record; deleted int := 0; skipped int := 0;
begin
  for r in
    select d.id, d.name from products d
    where d.is_deleted = true
      and exists (select 1 from products a
                  where a.is_deleted = false and lower(trim(a.name)) = lower(trim(d.name)))
  loop
    begin
      delete from products where id = r.id;
      deleted := deleted + 1;
    exception when foreign_key_violation then
      skipped := skipped + 1;
      raise notice 'Dilewati (masih dipakai riwayat): id=% name=%', r.id, r.name;
    end;
  end loop;
  raise notice 'Selesai: % dihapus, % dilewati', deleted, skipped;
end $$;
