-- features table
create table features (
  id bigint primary key generated always as identity,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- role_permissions table
create table role_permissions (
  id bigint primary key generated always as identity,
  role_id bigint not null references roles (id),
  feature_id bigint not null references features (id),
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, feature_id)
);
