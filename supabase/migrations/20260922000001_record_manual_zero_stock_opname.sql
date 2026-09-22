-- 209 products whose product_warehouse.stock was already 0 (some other prior mechanism had
-- set it, but they had never actually gone through a *confirmed* stock_opname session) and
-- which still carry "Opening Stock" (OPENING-BALANCE) placeholder data. The shop owner has
-- now manually physically counted every one of these products and confirmed the true stock
-- is 0 in each of their linked warehouses (2026-09-22).
--
-- Product 523 (Pipa 1¼ Aw Rucika) was originally in this batch too, but a live re-check found
-- its Gudang C stock is now 14 (real stock arrived after the list was generated), not 0 --
-- excluded here, needs handling separately.
--
-- Rather than hand-editing stock_batches, this records a real confirmed stock_opname session
-- per category (counted_stock = 0 for every warehouse the product is linked to) and runs the
-- actual confirm_stock_opname() function -- the same path the app itself uses -- so
-- product_warehouse stays consistent and any stale OPENING-BALANCE batch for these products
-- gets zeroed out exactly like a normal opname would do it.
--
-- Safety guard: for any product in this list whose *current* stock (at the moment this
-- migration actually runs) is no longer 0 in every one of its linked warehouses -- e.g. a
-- delivery or another opname landed in the meantime, same race that caught product 523 above
-- -- that product is silently skipped rather than wrongly zeroed.
do $$
declare
  v_admin_user_id bigint;
  v_product_ids integer[] := array[
    855,856,857,858,859,832,2110,852,853,854,638,1841,1842,2262,2030,2268,1650,1232,1231,1874,
    1850,2270,2166,1098,1139,1092,862,1097,1102,1107,1099,1100,1109,1101,1111,1113,1140,1141,
    1143,1110,1142,1138,1331,1114,1094,1137,1019,971,349,346,2123,1905,1279,1278,1280,2021,
    1966,1972,2355,2084,1904,1689,1687,1688,1686,1680,1679,1690,1672,1673,1675,1674,1677,1676,
    1678,1683,1685,1684,1864,1691,1692,1682,1681,2138,2139,1908,739,740,1128,1029,581,576,577,
    594,596,589,548,2107,531,2103,549,540,532,533,545,527,2120,1995,564,529,536,562,547,537,
    2073,2072,1968,628,630,947,942,943,948,949,997,987,614,602,609,616,617,610,646,870,871,873,
    1820,1655,1654,2056,1652,1879,1880,1849,2264,147,1666,1819,1192,1112,1108,1096,1172,1171,
    469,461,479,486,1057,297,887,417,418,169,170,179,1717,1743,1744,1745,1699,1710,1737,1701,
    1714,1734,1713,1741,1726,1704,439,430,437,436,432,585,1233,522,563,520,524,539,538,
    530,525,544,526,550,542,541,534,551,521,546,528,552,543,535,622
  ];
  v_category_id bigint;
  v_session_id bigint;
  v_product_id integer;
  v_item_id bigint;
  v_warehouse_id bigint;
  v_session_has_items boolean;
begin
  select created_by into v_admin_user_id
  from stock_opname_sessions
  order by created_at desc
  limit 1;

  for v_category_id in
    select distinct p.category_id
    from products p
    where p.id = any(v_product_ids)
  loop
    insert into stock_opname_sessions (category_id, created_by)
    values (v_category_id, v_admin_user_id)
    returning id into v_session_id;

    v_session_has_items := false;

    for v_product_id in
      select p.id
      from products p
      where p.id = any(v_product_ids)
        and p.category_id = v_category_id
        and exists (select 1 from product_warehouse pw where pw.product_id = p.id)
        and not exists (select 1 from product_warehouse pw where pw.product_id = p.id and pw.stock <> 0)
    loop
      insert into stock_opname_items (session_id, product_id)
      values (v_session_id, v_product_id)
      returning id into v_item_id;

      for v_warehouse_id in
        select pw.warehouse_id
        from product_warehouse pw
        where pw.product_id = v_product_id
      loop
        insert into stock_opname_item_warehouses (item_id, warehouse_id, counted_stock)
        values (v_item_id, v_warehouse_id, 0);
      end loop;

      v_session_has_items := true;
    end loop;

    if v_session_has_items then
      perform confirm_stock_opname(v_session_id);
    else
      delete from stock_opname_sessions where id = v_session_id;
    end if;
  end loop;
end;
$$;
