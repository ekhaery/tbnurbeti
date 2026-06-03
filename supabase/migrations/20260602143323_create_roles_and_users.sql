-- roles table
create table roles (
  id bigint primary key generated always as identity,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed roles
insert into roles (name) values
  ('admin'),
  ('user');

-- users table
create table users (
  id bigint primary key generated always as identity,
  name text not null,
  role_id bigint not null references roles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- seed users
insert into users (name, role_id) values
  ('faiz',  (select id from roles where name = 'admin')),
  ('nisa',  (select id from roles where name = 'admin')),
  ('fadel', (select id from roles where name = 'admin')),
  ('abah',  (select id from roles where name = 'admin')),
  ('ibu',   (select id from roles where name = 'admin')),
  ('fira',  (select id from roles where name = 'user')),
  ('supri', (select id from roles where name = 'user')),
  ('indah', (select id from roles where name = 'user'));
