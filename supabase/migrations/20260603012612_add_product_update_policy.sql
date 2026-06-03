create policy "authenticated can update products"
  on products for update
  to authenticated
  using (true)
  with check (true);
