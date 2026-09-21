-- Produk yang sudah confirmed stock opname tapi masih punya baris "Opening Stock"
-- (purchasing.code='OPENING-BALANCE', qty=200 placeholder) -- sisa bug trigger_opening_stock
-- sebelum fix di 20260919000001_trigger_opening_stock_skip_opname_products.sql.
--
-- Ditemukan lewat investigasi manual bahwa sebagian baris duplikat ini BUKAN cuma sampah
-- data mati: untuk produk yang duplikatnya dibuat SETELAH opname confirm tapi SEBELUM fix
-- di-deploy (mis. Casting A+, dan produk2 lain dengan duplikat bertanggal 18 Sep 2026),
-- baris itu masih qty_remaining>0 & is_available=true -- benar2 menggelembungkan stok yang
-- tampil ke user hari ini. Selain itu beberapa produk (mis. Avian, opname 3 Agustus) dulu
-- di-opname pakai versi LAMA confirm_stock_opname yang belum menyentuh stock_batches sama
-- sekali, jadi duplikatnya juga tidak pernah ter-nol otomatis.
--
-- Daripada whitelist manual (rawan salah transkrip / ketinggalan produk baru), migration ini
-- mencari produknya secara dinamis lewat query: SEMUA produk yang py confirmed stock opname
-- DAN py baris purchasing_items di bawah 'OPENING-BALANCE'.
--
-- stock_opname_sessions / stock_opname_items / stock_opname_item_warehouses / product_warehouse
-- TIDAK disentuh sama sekali.
do $$
declare
  v_product_id integer;
  v_session_id bigint;
  v_confirmed_at date;
  v_sold_since numeric;
  v_remaining numeric;
  v_batch record;
  v_take numeric;
begin
  -- 1. Netralkan SEMUA batch "Opening Stock" duplikat untuk produk yang sudah confirmed opname
  update stock_batches sb
  set qty_remaining = 0, is_available = false
  from purchasing_items pi
  join purchasing pur on pur.id = pi.purchasing_id
  where sb.purchasing_item_id = pi.id
    and pur.code = 'OPENING-BALANCE'
    and (sb.qty_remaining <> 0 or sb.is_available <> false)
    and exists (
      select 1
      from stock_opname_items soi
      join stock_opname_sessions sos on sos.id = soi.session_id
      where soi.product_id = pi.product_id and sos.status = 'confirmed'
    );

  -- 2. Rebuild qty_remaining batch hasil opname (sesi confirmed TERBARU) untuk tiap produk
  --    yang barusan disentuh di atas
  for v_product_id in
    select distinct pi.product_id
    from purchasing_items pi
    join purchasing pur on pur.id = pi.purchasing_id
    where pur.code = 'OPENING-BALANCE'
      and exists (
        select 1
        from stock_opname_items soi
        join stock_opname_sessions sos on sos.id = soi.session_id
        where soi.product_id = pi.product_id and sos.status = 'confirmed'
      )
  loop
    select sos.id, sos.created_at::date
    into v_session_id, v_confirmed_at
    from stock_opname_items soi
    join stock_opname_sessions sos on sos.id = soi.session_id
    where soi.product_id = v_product_id and sos.status = 'confirmed'
    order by sos.created_at desc
    limit 1;

    if v_session_id is null then
      continue;
    end if;

    select coalesce(sum(ti.qty), 0)
    into v_sold_since
    from transaction_items ti
    join transactions t on t.id = ti.transaction_id
    where ti.product_id = v_product_id
      and t.date >= v_confirmed_at
      and coalesce(t.is_initial_transformation, false) = false;

    v_remaining := v_sold_since;

    -- Kalau sesi confirmed terbarunya tidak punya batch STOCK-OPNAME-<session_id> sama
    -- sekali (produk yang di-opname pakai versi lama confirm_stock_opname, sebelum
    -- 20260913000001), loop ini otomatis tidak melakukan apa2 -- aman, karena divalidasi
    -- manual: semua kasus seperti itu di database sekarang counted_stock-nya memang 0.
    for v_batch in
      select sb.id, pi.qty as original_qty
      from stock_batches sb
      join purchasing_items pi on pi.id = sb.purchasing_item_id
      join purchasing pur on pur.id = pi.purchasing_id
      where pi.product_id = v_product_id
        and pur.code = 'STOCK-OPNAME-' || v_session_id
      order by sb.id
    loop
      v_take := least(v_batch.original_qty, v_remaining);
      update stock_batches
      set qty_remaining = v_batch.original_qty - v_take
      where id = v_batch.id;
      v_remaining := v_remaining - v_take;
    end loop;
  end loop;
end;
$$;
