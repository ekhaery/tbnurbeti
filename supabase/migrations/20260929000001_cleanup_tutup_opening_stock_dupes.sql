-- Tombol "Tutup" di popup "200++ transaksi tidak bisa masuk ke stok karena harga belum diisi"
-- (frontend/src/lib/Navbar.tsx, handleTutup) diam-diam menambah "Opening Stock" qty 200 setiap
-- kali diklik. Query stock_batches-nya tidak dipaginasi (Supabase max 1000 baris dari ~21.500),
-- jadi hampir semua produk dianggap belum punya stok, dan tidak ada cek stock opname sama sekali.
-- Ini sumber duplikat yang dibersihkan di 20260921000001 -- popup-nya sekarang dihapus.
--
-- Pada 2026-09-29 tombol itu membuat tepat 1000 batch OPENING-BALANCE (513 di antaranya produk
-- yang sudah confirmed stock opname, mis. Pintu WKD Alpen). Semua 1000 produk itu sudah punya
-- batch lain sebelumnya, jadi tidak ada satu pun yang merupakan opening stock sah.
--
-- Saat dicek sebelum migration ini dibuat, belum ada stock_batch_consumption dari batch2 tsb,
-- jadi cukup dinolkan -- stok produk otomatis kembali ke angka sebenarnya tanpa perlu rebuild.
-- Batch yang ternyata sudah dikonsumsi transaksi saat migration jalan dilewati (lihat notice)
-- supaya tidak memutus jejak FIFO; itu perlu dicek manual.
--
-- product_warehouse, stock_opname_* dan transaksi tidak disentuh (tombol Tutup juga tidak
-- pernah menyentuhnya).
do $$
declare
  v_zeroed integer;
  v_skipped integer;
begin
  with dupes as (
    select sb.id
    from stock_batches sb
    join purchasing_items pi on pi.id = sb.purchasing_item_id
    join purchasing pur on pur.id = pi.purchasing_id
    where pur.code = 'OPENING-BALANCE'
      and sb.received_at = '2026-09-29'
      and exists (
        select 1 from stock_batches older
        where older.product_id = sb.product_id
          and older.id <> sb.id
          and older.received_at < '2026-09-29'
      )
  )
  select count(*) filter (where exists (select 1 from stock_batch_consumption c where c.stock_batch_id = d.id))
  into v_skipped
  from dupes d;

  update stock_batches sb
  set qty_remaining = 0, is_available = false
  from purchasing_items pi
  join purchasing pur on pur.id = pi.purchasing_id
  where sb.purchasing_item_id = pi.id
    and pur.code = 'OPENING-BALANCE'
    and sb.received_at = '2026-09-29'
    and (sb.qty_remaining <> 0 or sb.is_available <> false)
    and exists (
      select 1 from stock_batches older
      where older.product_id = sb.product_id
        and older.id <> sb.id
        and older.received_at < '2026-09-29'
    )
    and not exists (select 1 from stock_batch_consumption c where c.stock_batch_id = sb.id);

  get diagnostics v_zeroed = row_count;
  raise notice 'Opening Stock 29 Sep dinolkan: %, dilewati karena sudah terjual: %', v_zeroed, v_skipped;
end;
$$;
