-- Perbaikan data order PUR-CVPUTRIJ-1-20261120 (CV Putri Jaya Makmur (PJM)).
-- Jalankan manual di Supabase SQL Editor, satu step per satu.
--
-- Masalah (diterima 24 Nov 2026, sebelum No Faktur & Jatuh Tempo diwajibkan):
--   * Kedua faktur tersimpan tanpa No Faktur & tanpa jatuh tempo -> tagihan tidak dibuat.
--   * Tee 3" Grest tercatat 1 pcs @ Rp 717.000, padahal 1 dus = 60 pcs @ Rp 11.950.
--   * Produk Tee 3" Grest terhapus (is_deleted) dan belum punya konversi Dus.
--
-- Hasil yang diinginkan:
--   Pipa 2½ D Aston : faktur N 261124015, JT 31 Des 2026
--   Tee 3" Grest    : 60 pcs @ 11.950 (1 Dus), faktur N 261124016, JT 31 Des 2026
--   Tagihan dibuat dengan rumus yang sama seperti ReceiveDeliveryOrderModal.


-- =====================================================================
-- STEP 1: PREVIEW (hanya membaca). Kirim hasilnya sebelum lanjut ke Step 2.
-- =====================================================================
select pi.id as item_id, pr.name as product, pr.id as product_id, pr.is_deleted,
       (select abbreviation from unit_of_measurements u where u.id = pr.unit_of_measurement_id) as base_unit,
       pi.qty, pi.base_price, pi.gross_base_price, pi.discount_percent,
       pi.entered_qty, pi.unit_of_measurement_id, pi.warehouse_id, pi.receipt_id,
       r.invoice_no, r.due_date, r.total as receipt_total,
       (r.created_at at time zone 'Asia/Jakarta')::date as received_on,
       sb.qty_remaining as batch_qty, sb.base_price as batch_price,
       pw.stock as warehouse_stock,
       (select count(*) from bills b where b.purchasing_receipt_id = r.id) as existing_bills
from purchasing p
join purchasing_items pi on pi.purchasing_id = p.id
join products pr on pr.id = pi.product_id
left join purchasing_receipts r on r.id = pi.receipt_id
left join stock_batches sb on sb.purchasing_item_id = pi.id
left join product_warehouse pw on pw.product_id = pi.product_id and pw.warehouse_id = pi.warehouse_id
where p.code = 'PUR-CVPUTRIJ-1-20261120'
order by pi.id;

-- Produk aktif lain dengan nama yang sama (harus kosong, kalau tidak pemulihan dibatalkan)
select id, name, is_deleted from products
where lower(trim(name)) = lower(trim('Tee 3" Grest')) and is_deleted = false;

-- Unit Dus dan konversi yang sudah ada untuk Tee 3" Grest
select id, name, abbreviation from unit_of_measurements where abbreviation = 'Dus';
select c.* from product_unit_conversions c
join purchasing_items pi on pi.product_id = c.product_id
join purchasing p on p.id = pi.purchasing_id
join products pr on pr.id = pi.product_id
where p.code = 'PUR-CVPUTRIJ-1-20261120' and pr.name ilike 'Tee 3" Grest';


-- =====================================================================
-- STEP 2: PERBAIKI. Satu blok: kalau ada yang tidak sesuai, semuanya dibatalkan.
-- Aman dijalankan ulang: tiap bagian hanya berlaku kalau datanya masih salah.
-- =====================================================================
do $$
declare
  v_code       constant text := 'PUR-CVPUTRIJ-1-20261120';
  v_due        constant date := '2026-12-31';
  v_pcs_per_dus constant int := 60;
  v_po         purchasing%rowtype;
  v_tee        purchasing_items%rowtype;
  v_pipa       purchasing_items%rowtype;
  v_dus_id     bigint;
  v_rec        record;
  v_weeks      int;
  v_n          int;
  v_inst       numeric;
  v_tolerance  date;
begin
  select * into v_po from purchasing where code = v_code;
  if v_po.id is null then raise exception 'Order % tidak ditemukan', v_code; end if;

  select pi.* into v_tee from purchasing_items pi join products pr on pr.id = pi.product_id
    where pi.purchasing_id = v_po.id and pr.name ilike 'Tee 3" Grest';
  select pi.* into v_pipa from purchasing_items pi join products pr on pr.id = pi.product_id
    where pi.purchasing_id = v_po.id and pr.name ilike 'Pipa 2½ D Aston';
  if v_tee.id is null or v_pipa.id is null then raise exception 'Item Tee 3" Grest / Pipa 2½ D Aston tidak ditemukan'; end if;
  if v_tee.receipt_id is null or v_pipa.receipt_id is null then raise exception 'Item belum diterima (receipt_id kosong)'; end if;

  select id into v_dus_id from unit_of_measurements where abbreviation = 'Dus';
  if v_dus_id is null then raise exception 'Unit Dus tidak ada'; end if;

  -- 1. Pulihkan produk Tee 3" Grest
  if exists (select 1 from products where lower(trim(name)) = lower(trim('Tee 3" Grest'))
             and is_deleted = false and id <> v_tee.product_id) then
    raise exception 'Sudah ada produk aktif bernama Tee 3" Grest, pemulihan dibatalkan';
  end if;
  update products set is_deleted = false, base_price = 11950, updated_at = now()
    where id = v_tee.product_id;

  -- 2. Konversi 1 Dus = 60 pcs untuk pembelian
  insert into product_unit_conversions (product_id, unit_of_measurement_id, factor_to_base, context)
    values (v_tee.product_id, v_dus_id, v_pcs_per_dus, 'purchase')
    on conflict (product_id, unit_of_measurement_id, context) do nothing;

  -- 3-5. Qty Tee 3" Grest: 1 -> 60 pcs, stok +59 (hanya kalau masih 1 @ 717.000)
  if v_tee.qty = 1 and v_tee.base_price = 717000 then
    update purchasing_items
      set qty = v_pcs_per_dus, base_price = 11950, gross_base_price = 11950,
          entered_qty = 1, unit_of_measurement_id = v_dus_id
      where id = v_tee.id;
    update stock_batches
      set qty_remaining = qty_remaining + (v_pcs_per_dus - 1), base_price = 11950, is_available = true
      where purchasing_item_id = v_tee.id;
    if not found then raise exception 'stock_batches untuk Tee 3" Grest tidak ditemukan'; end if;
    perform add_to_warehouse_stock(v_tee.product_id, v_tee.warehouse_id, v_pcs_per_dus - 1);
  elsif not (v_tee.qty = v_pcs_per_dus and v_tee.base_price = 11950) then
    raise exception 'Tee 3" Grest tidak dalam kondisi yang diharapkan (qty %, harga %)', v_tee.qty, v_tee.base_price;
  end if;

  -- 6. No Faktur & jatuh tempo per faktur
  update purchasing_receipts set invoice_no = 'N 261124015', due_date = v_due
    where id = v_pipa.receipt_id and invoice_no is null;
  update purchasing_receipts set invoice_no = 'N 261124016', due_date = v_due
    where id = v_tee.receipt_id and invoice_no is null;

  -- 7. Order
  update purchasing set invoice_no = 'N 261124016', due_date = v_due where id = v_po.id;

  -- 8. Tagihan per faktur (rumus sama dengan ReceiveDeliveryOrderModal)
  for v_rec in
    select r.id, r.total, (r.created_at at time zone 'Asia/Jakarta')::date as received_on
    from purchasing_receipts r
    where r.id in (v_pipa.receipt_id, v_tee.receipt_id)
      and not exists (select 1 from bills b where b.purchasing_receipt_id = r.id)
  loop
    v_weeks := round((v_due - v_rec.received_on) / 7.0);
    if v_weeks <= 0 then continue; end if;
    v_n := v_weeks + 3;
    v_inst := floor(v_rec.total / v_n);
    v_tolerance := v_due + 21;
    insert into bills (purchasing_id, purchasing_receipt_id, supplier_id, due_date,
                       installment_due_date, month, installment, paid_amount, bill_no)
    select v_po.id, v_rec.id, v_po.supplier_id, v_tolerance,
           v_rec.received_on + i * 7,
           to_char(v_tolerance, 'FMMonth YYYY'),
           case when i = v_n then v_rec.total - v_inst * (v_n - 1) else v_inst end,
           0,
           'BILL-' || v_code || '-R' || v_rec.id || '-' || i || '/' || v_n
    from generate_series(1, v_n) as i;
  end loop;
end $$;


-- =====================================================================
-- STEP 3: CEK HASIL (hanya membaca)
-- =====================================================================
-- Ulangi query pertama di Step 1: Tee 3" Grest harus 60 @ 11.950, is_deleted = false,
-- kedua faktur punya No Faktur & JT 31 Des 2026, existing_bills = 8 untuk masing-masing.

select b.purchasing_receipt_id, count(*) as cicilan, sum(b.installment) as total_tagihan,
       min(b.installment_due_date) as cicilan_pertama, max(b.installment_due_date) as cicilan_terakhir,
       max(b.due_date) as due_date, max(b.month) as month, r.total as total_faktur
from bills b
join purchasing_receipts r on r.id = b.purchasing_receipt_id
join purchasing p on p.id = b.purchasing_id
where p.code = 'PUR-CVPUTRIJ-1-20261120'
group by b.purchasing_receipt_id, r.total
order by b.purchasing_receipt_id;
