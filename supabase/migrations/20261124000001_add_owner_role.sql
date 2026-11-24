-- New "owner" role with full access. Every user who is "admin" today becomes
-- "owner"; "admin" stays as a restricted role without Laporan, Tagihan Dagang,
-- Pengambilan Barang, Finance and Settings > Users (enforced in the frontend,
-- see frontend/src/lib/roles.ts).
--
-- Rollout: deploy the frontend that knows about "owner" first, then run this
-- right after. Running it before the deploy hides the admin drawer from the
-- new owners until the frontend catches up.
insert into roles (name) values ('owner') on conflict (name) do nothing;

update users
  set role_id = (select id from roles where name = 'owner')
  where role_id = (select id from roles where name = 'admin');
