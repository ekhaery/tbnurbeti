create policy "authenticated can insert categories"
  on categories for insert
  to authenticated
  with check (true);

create policy "authenticated can update categories"
  on categories for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated can delete categories"
  on categories for delete
  to authenticated
  using (true);