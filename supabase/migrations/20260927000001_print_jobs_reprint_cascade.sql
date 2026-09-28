-- print_jobs was first created by hand for the "reprint" button in Riwayat
-- Transaksi (rows carry only transaction_id), so 20260925000007's
-- `create table if not exists` never added its columns in production. The
-- transaction_id FK also had no ON DELETE action, so any transaction that had
-- been reprinted could no longer be deleted:
--   update or delete on table "transactions" violates foreign key constraint
--   "print_jobs_transaction_id_fkey" on table "print_jobs"
-- Row kinds:
--   reprint     -> { transaction_id }
--   surat_jalan -> { type: 'surat_jalan', payload }

alter table print_jobs add column if not exists transaction_id integer;
alter table print_jobs add column if not exists type text;
alter table print_jobs add column if not exists payload jsonb;
alter table print_jobs add column if not exists created_by integer references users (id);

-- Reprint rows have no type/payload; surat jalan rows have no transaction_id
alter table print_jobs alter column transaction_id drop not null;
alter table print_jobs alter column type drop not null;
alter table print_jobs alter column payload drop not null;

alter table print_jobs drop constraint if exists print_jobs_transaction_id_fkey;
alter table print_jobs
  add constraint print_jobs_transaction_id_fkey
  foreign key (transaction_id) references transactions (id) on delete cascade;
